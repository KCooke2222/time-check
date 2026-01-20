import { useState, useEffect, useRef } from 'react';
import { categoriesAPI } from '../services/api';
import { useTree } from '@headless-tree/react';

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

// Custom tree item renderer
function TreeItemRenderer({ item, onDelete, onRename, onSelect, isSelected }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.getItemName());
  const inputRef = useRef(null);

  const itemMeta = item.getItemMeta();
  const isFolder = item.getData().type === 'section';
  const hasChildren = item.hasChildren();
  const isExpanded = item.isExpanded();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const currentName = item.getItemName();
    if (editValue.trim() && editValue !== currentName) {
      onRename(item.getData().id, editValue.trim(), isFolder);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(item.getItemName());
      setIsEditing(false);
    }
  };

  const itemProps = item.getProps();

  return (
    <div
      {...itemProps}
      onClick={(e) => {
        itemProps.onClick?.(e);
        onSelect(item);
      }}
      className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer transition-all group ${
        isSelected
          ? isFolder
            ? 'bg-yellow-100 border-l-4 border-yellow-500'
            : 'bg-blue-100 border-l-4 border-blue-500'
          : 'hover:bg-gray-50 border-l-4 border-transparent hover:border-' + (isFolder ? 'yellow' : 'blue') + '-300'
      }`}
      style={{ marginLeft: `${itemMeta.level * 24}px` }}
    >
      {/* Drag handle */}
      <button
        {...item.getDragProps()}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 px-2 py-1"
        onClick={(e) => e.stopPropagation()}
        title="Drag to move"
      >
        <svg width="16" height="20" viewBox="0 0 12 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5"/>
          <circle cx="9" cy="3" r="1.5"/>
          <circle cx="3" cy="8" r="1.5"/>
          <circle cx="9" cy="8" r="1.5"/>
          <circle cx="3" cy="13" r="1.5"/>
          <circle cx="9" cy="13" r="1.5"/>
        </svg>
      </button>

      {/* Collapse/expand button */}
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            item.toggle();
          }}
          className="text-gray-500 hover:text-gray-700 w-4 text-sm"
        >
          {isExpanded ? '▾' : '▸'}
        </button>
      ) : (
        <span className="w-4"></span>
      )}

      {/* Item name - editable */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="flex-1 cursor-text"
          title="Double-click to rename"
        >
          {item.getItemName()}
        </span>
      )}

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item.getData().id, !isFolder);
        }}
        className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity px-1"
        title={isFolder ? "Delete folder" : "Delete category"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.5a.5.5 0 0 0 0 1h.79l.812 10.56A1.5 1.5 0 0 0 5.6 15h4.8a1.5 1.5 0 0 0 1.498-1.44L12.71 3.5h.79a.5.5 0 0 0 0-1H11Z"/>
        </svg>
      </button>
    </div>
  );
}

function CategoryTree() {
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Selection state
  const [selectedItem, setSelectedItem] = useState(null);

  // Tag editing
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const tagInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedItem && selectedItem.getData().type === 'category') {
      const data = selectedItem.getData();
      const keywords = Array.isArray(data.keywords)
        ? data.keywords
        : (data.keywords ? JSON.parse(data.keywords) : []);
      setTags(keywords);
    }
  }, [selectedItem]);

  const loadData = async () => {
    try {
      const [sectionsData, categoriesData] = await Promise.all([
        categoriesAPI.listSections(),
        categoriesAPI.listCategories()
      ]);
      setSections(sectionsData.sections);
      setCategories(categoriesData.categories);
    } catch (err) {
      console.error('Failed to load data:', err);
      setMessage({ type: 'error', text: 'Failed to load' });
    } finally {
      setIsLoading(false);
    }
  };

  // Transform backend data to tree format for headless-tree
  const buildTreeData = () => {
    const itemsMap = {};
    const rootIds = [];

    // Recursive function to build section tree
    const buildSection = (section) => {
      const sectionId = `section-${section.id}`;
      const childIds = [];

      // Add child sections
      if (section.children && section.children.length > 0) {
        section.children.forEach(childSection => {
          const childId = buildSection(childSection);
          childIds.push(childId);
        });
      }

      // Add categories in this section
      const sectionCategories = categories.filter(c => c.section_id === section.id);
      sectionCategories.forEach(cat => {
        const catId = `category-${cat.id}`;
        itemsMap[catId] = {
          id: catId,
          name: cat.name,
          data: {
            id: cat.id,
            name: cat.name,
            type: 'category',
            keywords: cat.keywords,
            section_id: cat.section_id,
            original: cat
          },
          children: []
        };
        childIds.push(catId);
      });

      // Add section to map
      itemsMap[sectionId] = {
        id: sectionId,
        name: section.name,
        data: {
          id: section.id,
          name: section.name,
          type: 'section',
          original: section
        },
        children: childIds
      };

      return sectionId;
    };

    // Build root sections
    sections.forEach(section => {
      const sectionId = buildSection(section);
      rootIds.push(sectionId);
    });

    // Add root-level categories
    const rootCategories = categories.filter(c => !c.section_id);
    rootCategories.forEach(cat => {
      const catId = `category-${cat.id}`;
      itemsMap[catId] = {
        id: catId,
        name: cat.name,
        data: {
          id: cat.id,
          name: cat.name,
          type: 'category',
          keywords: cat.keywords,
          section_id: cat.section_id,
          original: cat
        },
        children: []
      };
      rootIds.push(catId);
    });

    return { itemsMap, rootIds };
  };

  const { itemsMap, rootIds } = buildTreeData();

  const tree = useTree({
    rootItemIds: rootIds,
    dataLoader: {
      getItem: (id) => {
        const item = itemsMap[id];
        if (!item) return null;
        return {
          id: item.id,
          name: item.name,
          data: item.data,
        };
      },
      getChildren: (id) => {
        const item = itemsMap[id];
        return item ? item.children : [];
      },
    },
    defaultExpandedItems: Object.keys(itemsMap).filter(id => id.startsWith('section-')),
    canDragItem: () => true,
    canDropInside: (draggedItem, target) => {
      // Can only drop inside sections (folders)
      const targetData = itemsMap[target.getId()]?.data;
      return targetData?.type === 'section';
    },
    canDropBefore: () => false,
    canDropAfter: () => false,
    onDrop: async ({ draggedItems, target }) => {
      if (!target || draggedItems.length === 0) return;

      const draggedItem = draggedItems[0];
      const draggedData = itemsMap[draggedItem.getId()]?.data;
      const targetData = itemsMap[target.getId()]?.data;

      if (!draggedData || !targetData) return;

      try {
        if (draggedData.type === 'section') {
          // Moving a section into another section
          await categoriesAPI.updateSection(draggedData.id, { parent_id: targetData.id });
        } else {
          // Moving a category into a section
          await categoriesAPI.updateCategory(draggedData.id, { section_id: targetData.id });
        }
        await loadData();
        setMessage({ type: 'success', text: 'Moved successfully' });
        setTimeout(() => setMessage(null), 2000);
      } catch (err) {
        setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to move' });
      }
    },
  });

  const handleSelect = (item) => {
    setSelectedItem(item);
  };

  const handleRename = async (id, newName, isFolder) => {
    try {
      if (isFolder) {
        await categoriesAPI.updateSection(id, { name: newName });
      } else {
        await categoriesAPI.updateCategory(id, { name: newName });
      }
      await loadData();
      setMessage({ type: 'success', text: 'Renamed successfully' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to rename' });
    }
  };

  const handleAddFolder = async () => {
    const parentId = selectedItem?.getData().type === 'section' ? selectedItem.getData().id : null;
    const timestamp = Date.now();
    const name = `New Folder ${timestamp}`;

    try {
      await categoriesAPI.createSection(name, parentId, 0);
      await loadData();
      setMessage({ type: 'success', text: 'Folder created' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create folder' });
    }
  };

  const handleAddCategory = async () => {
    const parentId = selectedItem?.getData().type === 'section' ? selectedItem.getData().id : null;
    const timestamp = Date.now();
    const name = `New Category ${timestamp}`;

    try {
      await categoriesAPI.createCategory(name, parentId, [], 0);
      await loadData();
      setMessage({ type: 'success', text: 'Category created' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create category' });
    }
  };

  const handleDelete = async (id, isCategory) => {
    const confirmMsg = isCategory
      ? 'Delete this category?'
      : 'Delete this folder and all contents?';

    if (!confirm(confirmMsg)) return;

    try {
      if (isCategory) {
        await categoriesAPI.deleteCategory(id);
      } else {
        await categoriesAPI.deleteSection(id);
      }
      setSelectedItem(null);
      await loadData();
      setMessage({ type: 'success', text: 'Deleted successfully' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedItem || selectedItem.getData().type !== 'category') return;

    const newTags = [...tags, newTag.trim()];
    setTags(newTags);
    setNewTag('');

    try {
      await categoriesAPI.updateCategory(selectedItem.getData().id, { keywords: newTags });
      await loadData();
      setMessage({ type: 'success', text: 'Tag added' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add tag' });
      setTags(tags); // Rollback
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    const newTags = tags.filter(t => t !== tagToRemove);
    setTags(newTags);

    try {
      await categoriesAPI.updateCategory(selectedItem.getData().id, { keywords: newTags });
      await loadData();
      setMessage({ type: 'success', text: 'Tag removed' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to remove tag' });
      setTags(tags); // Rollback
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

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: Tree View */}
      <div className="col-span-2">
        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <div className="border border-gray-200 rounded-lg bg-white">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex gap-2">
            <button
              onClick={handleAddFolder}
              className="px-3 py-1.5 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm font-medium"
            >
              + Folder
            </button>
            <button
              onClick={handleAddCategory}
              className="px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
            >
              + Category
            </button>
          </div>

          <div className="p-4" {...tree.getContainerProps()}>
            {rootIds.length === 0 ? (
              <p className="text-gray-400 text-center py-12">
                No categories yet
              </p>
            ) : (
              tree.getItems().map((item) => (
                <TreeItemRenderer
                  key={item.getId()}
                  item={item}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  onSelect={handleSelect}
                  isSelected={selectedItem?.getId?.() === item.getId()}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right: Properties Panel */}
      <div className="col-span-1">
        <div className="border border-gray-200 rounded-lg bg-white p-4 sticky top-4">
          {selectedItem && selectedItem.getData().type === 'category' ? (
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
                    <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z"/>
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
