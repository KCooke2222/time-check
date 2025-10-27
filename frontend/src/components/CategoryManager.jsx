import { useState, useEffect } from 'react';
import { categoriesAPI } from '../services/api';

function CategoryManager() {
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // Form states
  const [newSectionName, setNewSectionName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySection, setNewCategorySection] = useState('');
  const [newCategoryKeywords, setNewCategoryKeywords] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sectionsData, categoriesData] = await Promise.all([
        categoriesAPI.listSections(),
        categoriesAPI.listCategories(),
      ]);
      setSections(sectionsData.sections);
      setCategories(categoriesData.categories);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSection = async (e) => {
    e.preventDefault();
    try {
      await categoriesAPI.createSection(newSectionName);
      setNewSectionName('');
      setShowSectionForm(false);
      await loadData();
    } catch (err) {
      console.error('Failed to create section:', err);
      alert('Failed to create section');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      const keywords = newCategoryKeywords.split(',').map((k) => k.trim()).filter((k) => k);
      await categoriesAPI.createCategory(
        newCategoryName,
        parseInt(newCategorySection),
        keywords
      );
      setNewCategoryName('');
      setNewCategorySection('');
      setNewCategoryKeywords('');
      setShowCategoryForm(false);
      await loadData();
    } catch (err) {
      console.error('Failed to create category:', err);
      alert('Failed to create category');
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!confirm('Delete this section and all its categories?')) return;

    try {
      await categoriesAPI.deleteSection(sectionId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete section:', err);
      alert('Failed to delete section');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('Delete this category?')) return;

    try {
      await categoriesAPI.deleteCategory(categoryId);
      await loadData();
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert('Failed to delete category');
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading categories...</div>;
  }

  // Group categories by section
  const categoriesBySection = {};
  categories.forEach((cat) => {
    if (!categoriesBySection[cat.section_id]) {
      categoriesBySection[cat.section_id] = [];
    }
    categoriesBySection[cat.section_id].push(cat);
  });

  return (
    <div className="space-y-6">
      {/* Sections */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Sections & Categories</h3>
          <button
            onClick={() => setShowSectionForm(!showSectionForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            {showSectionForm ? 'Cancel' : 'Add Section'}
          </button>
        </div>

        {showSectionForm && (
          <form onSubmit={handleCreateSection} className="mb-4 p-4 border border-gray-200 rounded">
            <div className="flex gap-3">
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Section name (e.g., Fall 2024 Classes)"
                required
                className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {sections.length === 0 ? (
          <p className="text-gray-600">No sections yet. Create one to get started.</p>
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.id} className="border border-gray-200 rounded p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-md font-semibold text-gray-800">{section.name}</h4>
                  <button
                    onClick={() => handleDeleteSection(section.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete Section
                  </button>
                </div>

                {/* Categories in this section */}
                <div className="space-y-2 ml-4">
                  {categoriesBySection[section.id]?.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex justify-between items-center bg-gray-50 p-3 rounded"
                    >
                      <div>
                        <span className="font-medium text-gray-800">{cat.name}</span>
                        <div className="text-sm text-gray-600 mt-1">
                          Keywords: {cat.keywords.join(', ') || 'none'}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  ))}

                  {(!categoriesBySection[section.id] ||
                    categoriesBySection[section.id].length === 0) && (
                    <p className="text-sm text-gray-500 italic">No categories in this section</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Category Form */}
      <div>
        <button
          onClick={() => setShowCategoryForm(!showCategoryForm)}
          disabled={sections.length === 0}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm disabled:bg-gray-400"
        >
          {showCategoryForm ? 'Cancel' : 'Add Category'}
        </button>

        {showCategoryForm && (
          <form onSubmit={handleCreateCategory} className="mt-4 p-4 border border-gray-200 rounded">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Algorithms"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                <select
                  value={newCategorySection}
                  onChange={(e) => setNewCategorySection(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a section</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={newCategoryKeywords}
                  onChange={(e) => setNewCategoryKeywords(e.target.value)}
                  placeholder="e.g., 2341, algorithms, algo"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Keywords are used to match events. Use substrings that appear in your event
                  titles.
                </p>
              </div>
              <button
                type="submit"
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Create Category
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default CategoryManager;
