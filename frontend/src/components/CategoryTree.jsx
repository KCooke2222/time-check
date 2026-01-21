import { useState, useEffect, useRef } from 'react';
import { categoriesAPI } from '../services/api';
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';

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

function CategoryTree() {
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Selection state
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Tag editing
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const tagInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

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

  // Transform backend data to react-complex-tree format
  const buildTreeItems = () => {
    const items = {
      root: {
        index: 'root',
        isFolder: true,
        children: [],
        data: 'Root',
        canMove: false,
        canRename: false
      }
    };

    // Recursive function to build section tree
    const buildSection = (section, parentId = 'root') => {
      const sectionId = `section-${section.id}`;
      const childIds = [];

      // Add child sections
      if (section.children && section.children.length > 0) {
        section.children.forEach(childSection => {
          const childId = buildSection(childSection, sectionId);
          childIds.push(childId);
        });
      }

      // Add categories in this section
      const sectionCategories = categories.filter(c => c.section_id === section.id);
      sectionCategories.forEach(cat => {
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
            keywords: cat.keywords,
            section_id: cat.section_id,
            original: cat
          }
        };
        childIds.push(catId);
      });

      // Add section to items
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
          original: section
        }
      };

      // Add to parent's children
      items[parentId].children.push(sectionId);

      return sectionId;
    };

    // Build root sections
    sections.forEach(section => {
      buildSection(section, 'root');
    });

    // Add root-level categories
    const rootCategories = categories.filter(c => !c.section_id);
    rootCategories.forEach(cat => {
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
          keywords: cat.keywords,
          section_id: cat.section_id,
          original: cat
        }
      };
      items.root.children.push(catId);
    });

    return items;
  };

  const treeItems = buildTreeItems();

  // Handle item rename
  const handleRename = async (item, name) => {
    if (!item.metadata) return;

    try {
      if (item.metadata.type === 'section') {
        await categoriesAPI.updateSection(item.metadata.id, { name });
      } else {
        await categoriesAPI.updateCategory(item.metadata.id, { name });
      }
      await loadData();
      setMessage({ type: 'success', text: 'Renamed successfully' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to rename' });
    }
  };

  // Handle item drag-and-drop
  const handleDrop = async (itemIds, target) => {
    if (!target.targetItem || itemIds.length === 0) return;

    const draggedItemId = itemIds[0];
    const draggedItem = treeItems[draggedItemId];
    const targetItem = treeItems[target.targetItem];

    if (!draggedItem?.metadata || !targetItem?.metadata) return;

    // Can only drop into sections
    if (targetItem.metadata.type !== 'section') return;

    try {
      if (draggedItem.metadata.type === 'section') {
        await categoriesAPI.updateSection(draggedItem.metadata.id, { parent_id: targetItem.metadata.id });
      } else {
        await categoriesAPI.updateCategory(draggedItem.metadata.id, { section_id: targetItem.metadata.id });
      }
      await loadData();
      setMessage({ type: 'success', text: 'Moved successfully' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to move' });
    }
  };

  const handleAddFolder = async () => {
    let parentId = null;

    if (selectedItemId && treeItems[selectedItemId]?.metadata?.type === 'section') {
      parentId = treeItems[selectedItemId].metadata.id;
    }

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
    let parentId = null;

    if (selectedItemId && treeItems[selectedItemId]?.metadata?.type === 'section') {
      parentId = treeItems[selectedItemId].metadata.id;
    }

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

  const handleDelete = async (itemId) => {
    const item = treeItems[itemId];
    if (!item?.metadata) return;

    const isCategory = item.metadata.type === 'category';
    const confirmMsg = isCategory
      ? 'Delete this category?'
      : 'Delete this folder and all contents?';

    if (!confirm(confirmMsg)) return;

    try {
      if (isCategory) {
        await categoriesAPI.deleteCategory(item.metadata.id);
      } else {
        await categoriesAPI.deleteSection(item.metadata.id);
      }
      setSelectedItemId(null);
      await loadData();
      setMessage({ type: 'success', text: 'Deleted successfully' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  // Update tags when selection changes
  useEffect(() => {
    if (selectedItemId && treeItems[selectedItemId]) {
      const item = treeItems[selectedItemId];
      if (item.metadata?.type === 'category') {
        const keywords = Array.isArray(item.metadata.keywords)
          ? item.metadata.keywords
          : (item.metadata.keywords ? JSON.parse(item.metadata.keywords) : []);
        setTags(keywords);
      } else {
        setTags([]);
      }
    } else {
      setTags([]);
    }
  }, [selectedItemId, categories]);

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedItemId) return;

    const item = treeItems[selectedItemId];
    if (!item?.metadata || item.metadata.type !== 'category') return;

    const newTags = [...tags, newTag.trim()];
    setTags(newTags);
    setNewTag('');

    try {
      await categoriesAPI.updateCategory(item.metadata.id, { keywords: newTags });
      await loadData();
      setMessage({ type: 'success', text: 'Tag added' });
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add tag' });
      setTags(tags); // Rollback
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    if (!selectedItemId) return;

    const item = treeItems[selectedItemId];
    if (!item?.metadata || item.metadata.type !== 'category') return;

    const newTags = tags.filter(t => t !== tagToRemove);
    setTags(newTags);

    try {
      await categoriesAPI.updateCategory(item.metadata.id, { keywords: newTags });
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

  const selectedItem = selectedItemId ? treeItems[selectedItemId] : null;
  const showTagPanel = selectedItem?.metadata?.type === 'category';

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
            {selectedItemId && selectedItemId !== 'root' && (
              <button
                onClick={() => handleDelete(selectedItemId)}
                className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium ml-auto"
              >
                Delete
              </button>
            )}
          </div>

          <div className="p-4" style={{ height: '600px' }}>
            {treeItems.root.children.length === 0 ? (
              <p className="text-gray-400 text-center py-12">
                No categories yet
              </p>
            ) : (
              <UncontrolledTreeEnvironment
                dataProvider={new StaticTreeDataProvider(treeItems, (item, data) => ({ ...item, data }))}
                getItemTitle={item => item.data}
                viewState={{}}
                canDragAndDrop={true}
                canDropOnFolder={true}
                canReorderItems={false}
                canRename={true}
                onRenameItem={handleRename}
                onDrop={handleDrop}
                onSelectItems={(items) => {
                  if (items.length > 0) {
                    setSelectedItemId(items[0]);
                  }
                }}
                defaultInteractionMode={{
                  mode: 'custom',
                  extends: 'click-item-to-expand',
                  createInteractiveElementProps: (item, treeId, actions, renderFlags) => ({
                    onClick: (e) => {
                      actions.focusItem();
                      actions.selectItem();
                    },
                    onDoubleClick: (e) => {
                      e.stopPropagation();
                      if (item.isFolder) {
                        actions.toggleExpandedState();
                      }
                    }
                  })
                }}
              >
                <Tree
                  treeId="category-tree"
                  rootItem="root"
                  treeLabel="Categories"
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
