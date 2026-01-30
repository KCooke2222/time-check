import { useState, useEffect, useRef } from 'react';
import { categoriesAPI } from '../services/api';
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';

const TREE_ID = 'category-tree';
const ROOT_ID = 'root';

// Tag bubble component
function TagBubble({ tag, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
      {tag}
      <button
        onClick={() => onRemove(tag)}
        className="hover:text-blue-900"
        title="Remove tag"
      >
        ×
      </button>
    </span>
  );
}

const normalizeKeywords = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
};

const cloneItems = (items) => JSON.parse(JSON.stringify(items));

const buildTreeItemsFromData = (sections, categories) => {
  const items = {
    [ROOT_ID]: {
      index: ROOT_ID,
      isFolder: true,
      children: [],
      data: 'Root',
      canMove: false,
      canRename: false
    }
  };

  const categoriesBySection = new Map();
  categories.forEach((category) => {
    const key = category.section_id ?? ROOT_ID;
    if (!categoriesBySection.has(key)) {
      categoriesBySection.set(key, []);
    }
    categoriesBySection.get(key).push(category);
  });

  categoriesBySection.forEach((list) => {
    list.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  });

  const buildSection = (section, parentId) => {
    const sectionId = `section-${section.id}`;
    const childIds = [];

    const childSections = Array.isArray(section.children) ? section.children : [];
    childSections
      .slice()
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .forEach((childSection) => {
        const childId = buildSection(childSection, sectionId);
        childIds.push(childId);
      });

    const sectionCategories = categoriesBySection.get(section.id) || [];
    sectionCategories.forEach((cat) => {
      const catId = `category-${cat.id}`;
      items[catId] = {
        index: catId,
        isFolder: false,
        children: [],
        data: cat.name,
        canMove: true,
        canRename: true,
        metadata: {
          id: cat.id,
          type: 'category',
          keywords: normalizeKeywords(cat.keywords),
          section_id: cat.section_id,
          display_order: cat.display_order ?? 0
        }
      };
      childIds.push(catId);
    });

    items[sectionId] = {
      index: sectionId,
      isFolder: true,
      children: childIds,
      data: section.name,
      canMove: true,
      canRename: true,
      metadata: {
        id: section.id,
        type: 'section',
        parent_id: section.parent_id ?? null,
        display_order: section.display_order ?? 0
      }
    };

    items[parentId].children.push(sectionId);
    return sectionId;
  };

  const rootSections = sections.slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  rootSections.forEach((section) => buildSection(section, ROOT_ID));

  const rootCategories = categoriesBySection.get(ROOT_ID) || [];
  rootCategories.forEach((cat) => {
    const catId = `category-${cat.id}`;
    items[catId] = {
      index: catId,
      isFolder: false,
      children: [],
      data: cat.name,
      canMove: true,
      canRename: true,
      metadata: {
        id: cat.id,
        type: 'category',
        keywords: normalizeKeywords(cat.keywords),
        section_id: cat.section_id,
        display_order: cat.display_order ?? 0
      }
    };
    items[ROOT_ID].children.push(catId);
  });

  return items;
};

const getParentTreeId = (item) => {
  if (!item?.metadata) return ROOT_ID;
  if (item.metadata.type === 'section') {
    return item.metadata.parent_id ? `section-${item.metadata.parent_id}` : ROOT_ID;
  }
  if (item.metadata.type === 'category') {
    return item.metadata.section_id ? `section-${item.metadata.section_id}` : ROOT_ID;
  }
  return ROOT_ID;
};

const recalcDisplayOrder = (items, parentId) => {
  const parent = items[parentId];
  if (!parent) return items;
  const nextItems = { ...items };
  const children = parent.children.slice();

  let sectionOrder = 0;
  let categoryOrder = 0;

  children.forEach((childId) => {
    const child = nextItems[childId];
    if (!child?.metadata) return;
    if (child.metadata.type === 'section') {
      nextItems[childId] = {
        ...child,
        metadata: { ...child.metadata, display_order: sectionOrder }
      };
      sectionOrder += 1;
    } else if (child.metadata.type === 'category') {
      nextItems[childId] = {
        ...child,
        metadata: { ...child.metadata, display_order: categoryOrder }
      };
      categoryOrder += 1;
    }
  });

  return nextItems;
};

const removeItemAndDescendants = (items, itemId) => {
  const nextItems = { ...items };
  const queue = [itemId];
  while (queue.length) {
    const current = queue.pop();
    const item = nextItems[current];
    if (item?.children?.length) {
      item.children.forEach((childId) => queue.push(childId));
    }
    delete nextItems[current];
  }
  return nextItems;
};

const insertAfterIndex = (children, itemId, index) => {
  const next = children.slice();
  next.splice(index, 0, itemId);
  return next;
};

const getInsertionIndexForType = (children, items, type) => {
  if (type === 'section') {
    const firstCategoryIndex = children.findIndex((childId) => items[childId]?.metadata?.type === 'category');
    return firstCategoryIndex === -1 ? children.length : firstCategoryIndex;
  }
  return children.length;
};

const isDescendantSection = (items, potentialParentId, sectionId) => {
  if (!potentialParentId || potentialParentId === ROOT_ID) return false;
  let current = potentialParentId;
  while (current && current !== ROOT_ID) {
    if (current === sectionId) return true;
    const node = items[current];
    if (!node?.metadata || node.metadata.type !== 'section') break;
    const parentId = node.metadata.parent_id ? `section-${node.metadata.parent_id}` : ROOT_ID;
    current = parentId;
  }
  return false;
};

function CategoryTree() {
  const itemsRef = useRef(null);
  const dataProviderRef = useRef(null);

  const [treeVersion, setTreeVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  // Tag editing
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const tagInputRef = useRef(null);

  const treeItems = itemsRef.current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedItemId || selectedItemId === ROOT_ID) {
      setPendingDeleteId(null);
      return;
    }
    if (pendingDeleteId && pendingDeleteId !== selectedItemId) {
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, selectedItemId]);

  const showError = (text) => {
    setErrorMessage(text);
    setTimeout(() => setErrorMessage(null), 3000);
  };

  const replaceItems = (nextItems) => {
    if (!itemsRef.current) {
      itemsRef.current = nextItems;
      return;
    }
    const current = itemsRef.current;
    Object.keys(current).forEach((key) => {
      delete current[key];
    });
    Object.entries(nextItems).forEach(([key, value]) => {
      current[key] = value;
    });
  };

  const emitChanges = (changedIds) => {
    if (!dataProviderRef.current) return;
    const ids = Array.isArray(changedIds) && changedIds.length > 0 ? changedIds : [ROOT_ID];
    const filtered = ids.filter(Boolean);
    dataProviderRef.current.onDidChangeTreeDataEmitter.emit(filtered.length ? filtered : [ROOT_ID]);
  };

  const setItems = (nextItems, changedIds) => {
    replaceItems(nextItems);
    emitChanges(changedIds);
    setTreeVersion((prev) => prev + 1);
  };

  const loadData = async () => {
    try {
      const [sectionsData, categoriesData] = await Promise.all([
        categoriesAPI.listSections(),
        categoriesAPI.listCategories()
      ]);
      const nextItems = buildTreeItemsFromData(sectionsData.sections || [], categoriesData.categories || []);
      if (!itemsRef.current) {
        itemsRef.current = nextItems;
      } else {
        replaceItems(nextItems);
      }
      if (!dataProviderRef.current) {
        dataProviderRef.current = new StaticTreeDataProvider(itemsRef.current, (item, data) => ({ ...item, data }));
      }
      emitChanges([ROOT_ID]);
      setTreeVersion((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to load data:', err);
      showError('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const persistOrderForParent = async (items, parentId) => {
    if (!parentId || !items[parentId]) return;
    const parent = items[parentId];

    const sectionIds = parent.children.filter((childId) => items[childId]?.metadata?.type === 'section');
    const categoryIds = parent.children.filter((childId) => items[childId]?.metadata?.type === 'category');

    for (let index = 0; index < sectionIds.length; index += 1) {
      const childId = sectionIds[index];
      const item = items[childId];
      if (!item?.metadata || typeof item.metadata.id !== 'number') continue;
      if (item.metadata.display_order === index) continue;
      await categoriesAPI.updateSection(item.metadata.id, { display_order: index });
    }

    for (let index = 0; index < categoryIds.length; index += 1) {
      const childId = categoryIds[index];
      const item = items[childId];
      if (!item?.metadata || typeof item.metadata.id !== 'number') continue;
      if (item.metadata.display_order === index) continue;
      await categoriesAPI.updateCategory(item.metadata.id, { display_order: index });
    }
  };

  const updateParentForItem = async (item, newParentId) => {
    if (!item?.metadata) return;
    if (typeof item.metadata.id !== 'number') return;
    if (item.metadata.type === 'section') {
      const parentId = newParentId === ROOT_ID ? null : Number(newParentId.replace('section-', ''));
      await categoriesAPI.updateSection(item.metadata.id, { parent_id: parentId });
      return;
    }
    if (item.metadata.type === 'category') {
      const sectionId = newParentId === ROOT_ID ? null : Number(newParentId.replace('section-', ''));
      await categoriesAPI.updateCategory(item.metadata.id, { section_id: sectionId });
    }
  };

  const handleRename = async (item, name) => {
    if (!item?.metadata || !treeItems) return;
    const previousItems = cloneItems(treeItems);
    const nextItems = {
      ...treeItems,
      [item.index]: {
        ...treeItems[item.index],
        data: name
      }
    };
    setItems(nextItems, [item.index]);

    try {
      if (item.metadata.type === 'section') {
        await categoriesAPI.updateSection(item.metadata.id, { name });
      } else {
        await categoriesAPI.updateCategory(item.metadata.id, { name });
      }
    } catch (err) {
      setItems(previousItems, [item.index]);
      showError('Failed to rename');
    }
  };

  const handleDrop = async (itemIds, target) => {
    if (!treeItems || !target || itemIds.length === 0) return;
    const draggedItemId = itemIds[0];
    const draggedItem = treeItems[draggedItemId];
    if (!draggedItem?.metadata) return;

    const previousItems = cloneItems(treeItems);

    const targetType = target.targetType;
    let newParentId = ROOT_ID;
    let insertIndex = 0;

    if (targetType === 'between-items') {
      newParentId = target.parentItem || ROOT_ID;
    } else if (targetType === 'item') {
      newParentId = target.targetItem || ROOT_ID;
    } else if (targetType === 'root') {
      newParentId = ROOT_ID;
    } else {
      return;
    }

    if (newParentId !== ROOT_ID) {
      const parentItem = treeItems[newParentId];
      if (!parentItem?.isFolder) return;
    }

    if (draggedItem.metadata.type === 'section' && isDescendantSection(treeItems, newParentId, draggedItemId)) {
      return;
    }

    const oldParentId = getParentTreeId(draggedItem);

    const parentChildren = treeItems[newParentId]?.children || [];
    const filteredChildren = parentChildren.filter((childId) => childId !== draggedItemId);

    if (targetType === 'between-items') {
      const targetItem = target.targetItem;
      const targetIndex = filteredChildren.indexOf(targetItem);
      if (targetIndex === -1) return;
      const targetItemType = treeItems[targetItem]?.metadata?.type;
      if (targetItemType !== draggedItem.metadata.type) return;
      insertIndex = target.linePosition === 'bottom' ? targetIndex + 1 : targetIndex;
    } else {
      insertIndex = getInsertionIndexForType(filteredChildren, treeItems, draggedItem.metadata.type);
    }

    const nextItems = { ...treeItems };

    if (oldParentId && nextItems[oldParentId]) {
      nextItems[oldParentId] = {
        ...nextItems[oldParentId],
        children: nextItems[oldParentId].children.filter((childId) => childId !== draggedItemId)
      };
    }

    nextItems[newParentId] = {
      ...nextItems[newParentId],
      children: insertAfterIndex(filteredChildren, draggedItemId, insertIndex)
    };

    if (draggedItem.metadata.type === 'section') {
      nextItems[draggedItemId] = {
        ...draggedItem,
        metadata: {
          ...draggedItem.metadata,
          parent_id: newParentId === ROOT_ID ? null : Number(newParentId.replace('section-', ''))
        }
      };
    } else {
      nextItems[draggedItemId] = {
        ...draggedItem,
        metadata: {
          ...draggedItem.metadata,
          section_id: newParentId === ROOT_ID ? null : Number(newParentId.replace('section-', ''))
        }
      };
    }

    let recalced = recalcDisplayOrder(nextItems, newParentId);
    if (oldParentId && oldParentId !== newParentId) {
      recalced = recalcDisplayOrder(recalced, oldParentId);
    }

    setItems(recalced, [oldParentId, newParentId, draggedItemId]);

    try {
      if (typeof draggedItem.metadata.id === 'number') {
        if (oldParentId !== newParentId) {
          await updateParentForItem(draggedItem, newParentId);
        }
        await persistOrderForParent(recalced, oldParentId);
        if (oldParentId !== newParentId) {
          await persistOrderForParent(recalced, newParentId);
        }
      }
    } catch (err) {
      setItems(previousItems, [oldParentId, newParentId, draggedItemId]);
      showError(err.response?.data?.error || 'Failed to move');
    }
  };

  const handleAddFolder = async () => {
    if (!treeItems) return;
    const previousItems = cloneItems(treeItems);
    const selectedItem = selectedItemId ? treeItems[selectedItemId] : null;
    const parentId = selectedItem && selectedItemId !== ROOT_ID ? getParentTreeId(selectedItem) : ROOT_ID;
    const parentChildren = treeItems[parentId]?.children || [];

    const canPlaceNextTo = selectedItem && selectedItem.metadata?.type === 'section';
    let insertIndex;
    if (canPlaceNextTo) {
      const selectedIndex = parentChildren.indexOf(selectedItemId);
      insertIndex = selectedIndex === -1 ? getInsertionIndexForType(parentChildren, treeItems, 'section') : selectedIndex + 1;
    } else {
      insertIndex = getInsertionIndexForType(parentChildren, treeItems, 'section');
    }

    const tempId = `temp-section-${Date.now()}`;
    const optimisticItems = {
      ...treeItems,
      [tempId]: {
        index: tempId,
        isFolder: true,
        children: [],
        data: 'New Folder',
        canMove: true,
        canRename: true,
        metadata: {
          id: null,
          type: 'section',
          parent_id: parentId === ROOT_ID ? null : Number(parentId.replace('section-', '')),
          display_order: 0
        }
      },
      [parentId]: {
        ...treeItems[parentId],
        children: insertAfterIndex(parentChildren, tempId, insertIndex)
      }
    };

    const nextItems = recalcDisplayOrder(optimisticItems, parentId);
    setItems(nextItems, [parentId]);
    setSelectedItemId(tempId);

    try {
      const response = await categoriesAPI.createSection('New Folder', parentId === ROOT_ID ? null : Number(parentId.replace('section-', '')), 0);
      const created = response.section;
      const createdId = `section-${created.id}`;

      const withRealId = { ...nextItems };
      withRealId[createdId] = {
        ...withRealId[tempId],
        index: createdId,
        data: created.name,
        metadata: {
          ...withRealId[tempId].metadata,
          id: created.id,
          parent_id: created.parent_id,
          display_order: created.display_order ?? withRealId[tempId].metadata.display_order
        }
      };
      delete withRealId[tempId];
      withRealId[parentId] = {
        ...withRealId[parentId],
        children: withRealId[parentId].children.map((childId) => (childId === tempId ? createdId : childId))
      };

      const recalced = recalcDisplayOrder(withRealId, parentId);
      setItems(recalced, [parentId]);
      setSelectedItemId(createdId);
      await persistOrderForParent(recalced, parentId);
    } catch (err) {
      setItems(previousItems, [parentId]);
      showError('Failed to create folder');
    }
  };

  const handleAddCategory = async () => {
    if (!treeItems) return;
    const previousItems = cloneItems(treeItems);
    const selectedItem = selectedItemId ? treeItems[selectedItemId] : null;
    const parentId = selectedItem && selectedItemId !== ROOT_ID ? getParentTreeId(selectedItem) : ROOT_ID;
    const parentChildren = treeItems[parentId]?.children || [];

    const canPlaceNextTo = selectedItem && selectedItem.metadata?.type === 'category';
    let insertIndex;
    if (canPlaceNextTo) {
      const selectedIndex = parentChildren.indexOf(selectedItemId);
      insertIndex = selectedIndex === -1 ? getInsertionIndexForType(parentChildren, treeItems, 'category') : selectedIndex + 1;
    } else {
      insertIndex = getInsertionIndexForType(parentChildren, treeItems, 'category');
    }

    const tempId = `temp-category-${Date.now()}`;
    const optimisticItems = {
      ...treeItems,
      [tempId]: {
        index: tempId,
        isFolder: false,
        children: [],
        data: 'New Category',
        canMove: true,
        canRename: true,
        metadata: {
          id: null,
          type: 'category',
          keywords: [],
          section_id: parentId === ROOT_ID ? null : Number(parentId.replace('section-', '')),
          display_order: 0
        }
      },
      [parentId]: {
        ...treeItems[parentId],
        children: insertAfterIndex(parentChildren, tempId, insertIndex)
      }
    };

    const nextItems = recalcDisplayOrder(optimisticItems, parentId);
    setItems(nextItems, [parentId]);
    setSelectedItemId(tempId);

    try {
      const response = await categoriesAPI.createCategory('New Category', parentId === ROOT_ID ? null : Number(parentId.replace('section-', '')), [], 0);
      const created = response.category;
      const createdId = `category-${created.id}`;

      const withRealId = { ...nextItems };
      withRealId[createdId] = {
        ...withRealId[tempId],
        index: createdId,
        data: created.name,
        metadata: {
          ...withRealId[tempId].metadata,
          id: created.id,
          section_id: created.section_id,
          display_order: created.display_order ?? withRealId[tempId].metadata.display_order
        }
      };
      delete withRealId[tempId];
      withRealId[parentId] = {
        ...withRealId[parentId],
        children: withRealId[parentId].children.map((childId) => (childId === tempId ? createdId : childId))
      };

      const recalced = recalcDisplayOrder(withRealId, parentId);
      setItems(recalced, [parentId]);
      setSelectedItemId(createdId);
      await persistOrderForParent(recalced, parentId);
    } catch (err) {
      setItems(previousItems, [parentId]);
      showError('Failed to create category');
    }
  };

  const handleDelete = async (itemId) => {
    if (!treeItems) return;
    const item = treeItems[itemId];
    if (!item?.metadata) return;

    const previousItems = cloneItems(treeItems);
    const parentId = getParentTreeId(item);

    let nextItems = {
      ...treeItems,
      [parentId]: {
        ...treeItems[parentId],
        children: treeItems[parentId].children.filter((childId) => childId !== itemId)
      }
    };
    nextItems = removeItemAndDescendants(nextItems, itemId);
    nextItems = recalcDisplayOrder(nextItems, parentId);

    setItems(nextItems, [parentId]);
    setSelectedItemId(parentId === ROOT_ID ? null : parentId);
    setPendingDeleteId(null);

    try {
      if (typeof item.metadata.id !== 'number') return;
      if (item.metadata.type === 'category') {
        await categoriesAPI.deleteCategory(item.metadata.id);
      } else {
        await categoriesAPI.deleteSection(item.metadata.id);
      }
      await persistOrderForParent(nextItems, parentId);
    } catch (err) {
      setItems(previousItems, [parentId]);
      showError('Failed to delete');
    }
  };

  useEffect(() => {
    if (selectedItemId && treeItems && treeItems[selectedItemId]) {
      const item = treeItems[selectedItemId];
      if (item.metadata?.type === 'category') {
        setTags(normalizeKeywords(item.metadata.keywords));
      } else {
        setTags([]);
      }
    } else {
      setTags([]);
    }
  }, [selectedItemId, treeItems, treeVersion]);

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedItemId || !treeItems) return;
    const item = treeItems[selectedItemId];
    if (!item?.metadata || item.metadata.type !== 'category') return;

    const previousItems = cloneItems(treeItems);
    const nextTags = [...tags, newTag.trim()];
    setTags(nextTags);
    setNewTag('');

    const updatedItems = {
      ...treeItems,
      [selectedItemId]: {
        ...item,
        metadata: {
          ...item.metadata,
          keywords: nextTags
        }
      }
    };

    setItems(updatedItems, [selectedItemId]);

    try {
      await categoriesAPI.updateCategory(item.metadata.id, { keywords: nextTags });
    } catch (err) {
      setItems(previousItems, [selectedItemId]);
      setTags(tags);
      showError('Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    if (!selectedItemId || !treeItems) return;
    const item = treeItems[selectedItemId];
    if (!item?.metadata || item.metadata.type !== 'category') return;

    const previousItems = cloneItems(treeItems);
    const nextTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(nextTags);

    const updatedItems = {
      ...treeItems,
      [selectedItemId]: {
        ...item,
        metadata: {
          ...item.metadata,
          keywords: nextTags
        }
      }
    };

    setItems(updatedItems, [selectedItemId]);

    try {
      await categoriesAPI.updateCategory(item.metadata.id, { keywords: nextTags });
    } catch (err) {
      setItems(previousItems, [selectedItemId]);
      setTags(tags);
      showError('Failed to remove tag');
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  if (!treeItems || !dataProviderRef.current) {
    return <div className="text-center py-8 text-gray-500">No tree data</div>;
  }

  const selectedItem = selectedItemId ? treeItems[selectedItemId] : null;
  const showTagPanel = selectedItem?.metadata?.type === 'category';

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: Tree View */}
      <div className="col-span-2">
        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
            <button
              onClick={handleAddFolder}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
              title="New folder"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M10 4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6z" />
              </svg>
              <span className="text-sm font-medium">Folder</span>
            </button>
            <button
              onClick={handleAddCategory}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
              title="New category"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20 4H4a2 2 0 0 0-2 2v4h20V6a2 2 0 0 0-2-2zm0 8H2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6z" />
              </svg>
              <span className="text-sm font-medium">Category</span>
            </button>
          </div>

          <div className="p-4" style={{ height: '600px' }}>
            {treeItems[ROOT_ID].children.length === 0 ? (
              <p className="text-gray-400 text-center py-12">
                No categories yet
              </p>
            ) : (
              <UncontrolledTreeEnvironment
                dataProvider={dataProviderRef.current}
                getItemTitle={(item) => item.data}
                viewState={{}}
                canDragAndDrop={true}
                canDropOnFolder={true}
                canDropOnNonFolder={false}
                canReorderItems={true}
                canRename={true}
                onRenameItem={handleRename}
                onDrop={handleDrop}
                onSelectItems={(items) => {
                  if (items.length > 0) {
                    setSelectedItemId(items[0]);
                  } else {
                    setSelectedItemId(null);
                  }
                }}
                canDropAt={(items, target) => {
                  if (!treeItems || !items.length) return false;
                  const draggedId = items[0];
                  const draggedItem = treeItems[draggedId];
                  if (!draggedItem?.metadata) return false;

                  if (target.targetType === 'between-items') {
                    const parentId = target.parentItem || ROOT_ID;
                    const parentItem = treeItems[parentId];
                    if (parentId !== ROOT_ID && !parentItem?.isFolder) return false;
                    const targetItem = treeItems[target.targetItem];
                    if (!targetItem?.metadata) return false;
                    return targetItem.metadata.type === draggedItem.metadata.type;
                  }

                  if (target.targetType === 'root') return true;

                  if (target.targetType === 'item') {
                    const targetItem = treeItems[target.targetItem];
                    if (!targetItem?.isFolder) return false;
                    if (draggedItem.metadata.type === 'section') {
                      return !isDescendantSection(treeItems, target.targetItem, draggedId);
                    }
                    return true;
                  }

                  return false;
                }}
                defaultInteractionMode={{
                  mode: 'custom',
                  extends: 'click-arrow-to-expand',
                  createInteractiveElementProps: (item, treeId, actions, renderFlags) => ({
                    onClick: () => {
                      actions.focusItem();
                      actions.selectItem();
                    },
                    onDoubleClick: (e) => {
                      e.stopPropagation();
                      if (item.canRename) {
                        actions.startRenamingItem();
                      }
                    },
                    onFocus: () => actions.focusItem(),
                    tabIndex: !renderFlags.isRenaming ? (renderFlags.isFocused ? 0 : -1) : undefined
                  })
                }}
              >
                <Tree
                  treeId={TREE_ID}
                  rootItem={ROOT_ID}
                  treeLabel="Categories"
                  renderItemTitle={({ title, context, item }) => {
                    const isSelected = context.isSelected;
                    const showActions = isSelected && item.index !== ROOT_ID;
                    return (
                      <div className="flex items-center gap-2 w-full">
                        <span className="truncate">{title}</span>
                        {showActions && !context.isRenaming && (
                          <div className="ml-auto relative flex items-center gap-1">
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDeleteId(item.index);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setPendingDeleteId(item.index);
                                }
                              }}
                              className="p-1 rounded hover:bg-red-50 text-red-600"
                              title="Delete"
                              aria-label="Delete"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M6 7h12l-1 14H7L6 7zm9-3l1 1h4v2H4V5h4l1-1h6z" />
                              </svg>
                            </span>
                            {pendingDeleteId === item.index && (
                              <div
                                className="absolute right-0 top-full mt-1 z-10 rounded border border-gray-200 bg-white shadow-sm p-2 flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-xs text-gray-600">Delete?</span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="text-xs text-white bg-red-600 rounded px-2 py-1 hover:bg-red-700"
                                  onClick={() => handleDelete(item.index)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      handleDelete(item.index);
                                    }
                                  }}
                                >
                                  Delete
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="text-xs text-gray-600 rounded px-2 py-1 hover:bg-gray-100"
                                  onClick={() => setPendingDeleteId(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setPendingDeleteId(null);
                                    }
                                  }}
                                >
                                  Cancel
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }}
                  renderRenameInput={({ formProps, inputProps, inputRef }) => {
                    const handleBlur = (event) => {
                      if (inputProps?.onBlur) {
                        inputProps.onBlur(event);
                      }
                      if (inputRef?.current?.form?.requestSubmit) {
                        inputRef.current.form.requestSubmit();
                      } else if (formProps?.onSubmit) {
                        formProps.onSubmit({ preventDefault: () => {}, stopPropagation: () => {} });
                      }
                    };

                    return (
                      <form {...formProps}>
                        <input
                          {...inputProps}
                          ref={inputRef}
                          onBlur={handleBlur}
                          className="px-1 py-0.5 border border-blue-300 rounded text-sm focus:outline-none"
                        />
                      </form>
                    );
                  }}
                />
              </UncontrolledTreeEnvironment>
            )}
          </div>
        </div>
      </div>

      {/* Right: Properties Panel */}
      <div className="col-span-1">
        <div className="border border-gray-200 rounded-lg bg-white p-4 sticky top-4">
          {showTagPanel ? (
            <>
              <h3 className="font-semibold text-gray-900 mb-4">Tags</h3>

              {/* Tags list */}
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag) => (
                  <TagBubble key={tag} tag={tag} onRemove={handleRemoveTag} />
                ))}
              </div>

              {/* Add tag input */}
              <div className="flex gap-2">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add tag..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={handleAddTag}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  title="Add tag"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z" />
                  </svg>
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Tags are matched against calendar event titles
              </p>
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="mb-2">Select a category</p>
              <p className="text-sm">to edit tags</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CategoryTree;
