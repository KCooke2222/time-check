import { useState, useEffect } from 'react';
import { categoriesAPI } from '../services/api';

function CategoryTreeManagerSimple() {
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Form states
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionParent, setNewSectionParent] = useState(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySection, setNewCategorySection] = useState(null);
  const [newCategoryKeywords, setNewCategoryKeywords] = useState('');

  // Collapsed state for folders
  const [collapsed, setCollapsed] = useState({});

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
      setMessage({ type: 'error', text: 'Failed to load categories' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSection = async () => {
    if (!newSectionName.trim()) return;

    try {
      await categoriesAPI.createSection(newSectionName, newSectionParent, 0);
      setMessage({ type: 'success', text: 'Folder created!' });
      setNewSectionName('');
      setNewSectionParent(null);
      setShowSectionForm(false);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create folder' });
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !newCategoryKeywords.trim()) {
      setMessage({ type: 'error', text: 'Name and keywords are required' });
      return;
    }

    try {
      const keywords = newCategoryKeywords.split(',').map(k => k.trim()).filter(k => k);
      await categoriesAPI.createCategory(newCategoryName, newCategorySection, keywords, 0);
      setMessage({ type: 'success', text: 'Category created!' });
      setNewCategoryName('');
      setNewCategorySection(null);
      setNewCategoryKeywords('');
      setShowCategoryForm(false);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create category' });
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!confirm('Delete this folder and all its contents?')) return;

    try {
      await categoriesAPI.deleteSection(sectionId);
      setMessage({ type: 'success', text: 'Folder deleted' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete folder' });
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('Delete this category?')) return;

    try {
      await categoriesAPI.deleteCategory(categoryId);
      setMessage({ type: 'success', text: 'Category deleted' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete category' });
    }
  };

  const handleMoveCategory = async (categoryId, newSectionId) => {
    try {
      await categoriesAPI.updateCategory(categoryId, { section_id: newSectionId });
      setMessage({ type: 'success', text: 'Category moved!' });
      setEditingItem(null);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to move category' });
    }
  };

  const handleMoveSection = async (sectionId, newParentId) => {
    try {
      await categoriesAPI.updateSection(sectionId, { parent_id: newParentId });
      setMessage({ type: 'success', text: 'Folder moved!' });
      setEditingItem(null);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to move folder' });
    }
  };

  const toggleCollapse = (sectionId) => {
    setCollapsed(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Flatten sections for dropdown (with indentation indicators)
  const flattenSectionsForDropdown = (sectionList, depth = 0, excludeId = null) => {
    let result = [];
    for (const section of sectionList) {
      if (section.id !== excludeId) {
        result.push({ ...section, depth });
        if (section.children && section.children.length > 0) {
          result = result.concat(flattenSectionsForDropdown(section.children, depth + 1, excludeId));
        }
      }
    }
    return result;
  };

  // Render a section recursively
  const renderSection = (section, depth = 0) => {
    const sectionCategories = categories.filter(c => c.section_id === section.id);
    const hasChildren = section.children && section.children.length > 0;
    const hasCategories = sectionCategories.length > 0;
    const isCollapsed = collapsed[section.id];
    const isEditing = editingItem?.type === 'section' && editingItem?.id === section.id;

    return (
      <div key={section.id} className="ml-4">
        <div className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded px-2 group">
          {/* Collapse/expand button */}
          {(hasChildren || hasCategories) && (
            <button
              onClick={() => toggleCollapse(section.id)}
              className="text-gray-500 hover:text-gray-700 w-4"
            >
              {isCollapsed ? '▶' : '▼'}
            </button>
          )}
          {(!hasChildren && !hasCategories) && <span className="w-4"></span>}

          {/* Folder icon */}
          <span className="text-yellow-600">📁</span>

          {/* Section name */}
          <span className="font-medium text-gray-800 flex-1">{section.name}</span>

          {/* Move button */}
          <button
            onClick={() => setEditingItem({ type: 'section', id: section.id, name: section.name })}
            className="text-blue-600 hover:text-blue-800 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Move
          </button>

          {/* Delete button */}
          <button
            onClick={() => handleDeleteSection(section.id)}
            className="text-red-600 hover:text-red-800 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Delete
          </button>
        </div>

        {/* Move dropdown */}
        {isEditing && (
          <div className="ml-8 mb-2 p-2 bg-blue-50 rounded">
            <p className="text-sm font-medium mb-2">Move "{section.name}" to:</p>
            <select
              onChange={(e) => {
                const newParentId = e.target.value || null;
                handleMoveSection(section.id, newParentId);
              }}
              className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
              defaultValue=""
            >
              <option value="">Root Level</option>
              {flattenSectionsForDropdown(sections, 0, section.id).map(sec => (
                <option key={sec.id} value={sec.id}>
                  {'  '.repeat(sec.depth) + '📁 ' + sec.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setEditingItem(null)}
              className="mt-2 text-xs text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Children (if not collapsed) */}
        {!isCollapsed && (
          <>
            {/* Nested sections */}
            {hasChildren && section.children.map(child => renderSection(child, depth + 1))}

            {/* Categories in this section */}
            {hasCategories && sectionCategories.map(cat => {
              const isCatEditing = editingItem?.type === 'category' && editingItem?.id === cat.id;

              return (
                <div key={cat.id}>
                  <div className="ml-8 flex items-center gap-2 py-1 hover:bg-gray-50 rounded px-2 group">
                    <span className="text-blue-600">📄</span>
                    <span className="text-gray-800 flex-1">{cat.name}</span>
                    <span className="text-xs text-gray-500">
                      {cat.keywords ? (Array.isArray(cat.keywords) ? cat.keywords.join(', ') : JSON.parse(cat.keywords).join(', ')) : ''}
                    </span>
                    <button
                      onClick={() => setEditingItem({ type: 'category', id: cat.id, name: cat.name })}
                      className="text-blue-600 hover:text-blue-800 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Move
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-red-600 hover:text-red-800 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  </div>

                  {/* Move dropdown for category */}
                  {isCatEditing && (
                    <div className="ml-12 mb-2 p-2 bg-blue-50 rounded">
                      <p className="text-sm font-medium mb-2">Move "{cat.name}" to:</p>
                      <select
                        onChange={(e) => {
                          const newSectionId = e.target.value || null;
                          handleMoveCategory(cat.id, newSectionId);
                        }}
                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                        defaultValue=""
                      >
                        <option value="">Root Level</option>
                        {flattenSectionsForDropdown(sections, 0).map(sec => (
                          <option key={sec.id} value={sec.id}>
                            {'  '.repeat(sec.depth) + '📁 ' + sec.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setEditingItem(null)}
                        className="mt-2 text-xs text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  // Root-level categories (no section)
  const rootCategories = categories.filter(c => c.section_id === null);

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const flatSections = flattenSectionsForDropdown(sections);

  return (
    <div>
      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowSectionForm(!showSectionForm)}
          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-medium"
        >
          {showSectionForm ? 'Cancel' : '+ Add Folder'}
        </button>
        <button
          onClick={() => setShowCategoryForm(!showCategoryForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
        >
          {showCategoryForm ? 'Cancel' : '+ Add Trackable'}
        </button>
      </div>

      {/* Create Section Form */}
      {showSectionForm && (
        <div className="mb-4 p-4 border border-gray-200 rounded bg-gray-50">
          <h4 className="font-semibold mb-3">Create New Folder</h4>
          <input
            type="text"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            placeholder="Folder name (e.g., Total Work, Studying)"
            className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
          />
          <select
            value={newSectionParent || ''}
            onChange={(e) => setNewSectionParent(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded mb-3"
          >
            <option value="">Root Level (no parent)</option>
            {flatSections.map(section => (
              <option key={section.id} value={section.id}>
                {'  '.repeat(section.depth) + '📁 ' + section.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreateSection}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Create Folder
          </button>
        </div>
      )}

      {/* Create Category Form */}
      {showCategoryForm && (
        <div className="mb-4 p-4 border border-gray-200 rounded bg-gray-50">
          <h4 className="font-semibold mb-3">Create New Trackable Category</h4>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category name (e.g., 1302, gym, piano)"
            className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
          />
          <select
            value={newCategorySection || ''}
            onChange={(e) => setNewCategorySection(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
          >
            <option value="">Root Level (no folder)</option>
            {flatSections.map(section => (
              <option key={section.id} value={section.id}>
                {'  '.repeat(section.depth) + '📁 ' + section.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newCategoryKeywords}
            onChange={(e) => setNewCategoryKeywords(e.target.value)}
            placeholder="Keywords (comma-separated, e.g., 1302, comp sci, algorithms)"
            className="w-full px-3 py-2 border border-gray-300 rounded mb-2"
          />
          <p className="text-sm text-gray-600 mb-3">
            Keywords match event titles. Any keyword found in the title will categorize the event here.
          </p>
          <button
            onClick={handleCreateCategory}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Category
          </button>
        </div>
      )}

      {/* Tree View */}
      <div className="border border-gray-200 rounded p-4 bg-white">
        <h3 className="font-semibold text-lg mb-3">Category Tree</h3>

        {/* Root sections */}
        {sections.length === 0 && rootCategories.length === 0 && (
          <p className="text-gray-500 text-center py-8">No categories yet. Create a folder or trackable category above.</p>
        )}

        {sections.map(section => renderSection(section))}

        {/* Root-level categories */}
        {rootCategories.map(cat => {
          const isCatEditing = editingItem?.type === 'category' && editingItem?.id === cat.id;

          return (
            <div key={cat.id}>
              <div className="ml-4 flex items-center gap-2 py-1 hover:bg-gray-50 rounded px-2 group">
                <span className="w-4"></span>
                <span className="text-blue-600">📄</span>
                <span className="text-gray-800 flex-1">{cat.name}</span>
                <span className="text-xs text-gray-500">
                  {cat.keywords ? (Array.isArray(cat.keywords) ? cat.keywords.join(', ') : JSON.parse(cat.keywords).join(', ')) : ''}
                </span>
                <button
                  onClick={() => setEditingItem({ type: 'category', id: cat.id, name: cat.name })}
                  className="text-blue-600 hover:text-blue-800 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Move
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="text-red-600 hover:text-red-800 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Delete
                </button>
              </div>

              {/* Move dropdown for root category */}
              {isCatEditing && (
                <div className="ml-8 mb-2 p-2 bg-blue-50 rounded">
                  <p className="text-sm font-medium mb-2">Move "{cat.name}" to:</p>
                  <select
                    onChange={(e) => {
                      const newSectionId = e.target.value || null;
                      handleMoveCategory(cat.id, newSectionId);
                    }}
                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                    defaultValue=""
                  >
                    <option value="">Root Level</option>
                    {flatSections.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {'  '.repeat(sec.depth) + '📁 ' + sec.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setEditingItem(null)}
                    className="mt-2 text-xs text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>📁 <strong>Folders</strong> organize your categories hierarchically (like "Total Work" → "Studying")</li>
          <li>📄 <strong>Trackable categories</strong> have keywords that match your calendar events</li>
          <li>Click <strong>"Move"</strong> button to relocate folders or categories</li>
          <li>Reports will aggregate hours up the folder hierarchy</li>
        </ul>
      </div>
    </div>
  );
}

export default CategoryTreeManagerSimple;
