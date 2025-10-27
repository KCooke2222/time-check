import { useState, useEffect } from 'react';
import { categoriesAPI } from '../services/api';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Draggable Section Component
function DraggableSection({ section, depth, onDelete, onToggleCollapse, isCollapsed, categories, allSections }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `section-${section.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: `${depth * 24}px`,
  };

  const sectionCategories = categories.filter(c => c.section_id === section.id);
  const hasChildren = section.children && section.children.length > 0;
  const hasCategories = sectionCategories.length > 0;

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded group border-l-2 border-transparent hover:border-yellow-500">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 px-1"
          title="Drag to move"
        >
          <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
            <circle cx="3" cy="3" r="1.5"/>
            <circle cx="9" cy="3" r="1.5"/>
            <circle cx="3" cy="8" r="1.5"/>
            <circle cx="9" cy="8" r="1.5"/>
            <circle cx="3" cy="13" r="1.5"/>
            <circle cx="9" cy="13" r="1.5"/>
          </svg>
        </button>

        {/* Collapse/expand button */}
        {(hasChildren || hasCategories) ? (
          <button
            onClick={() => onToggleCollapse(section.id)}
            className="text-gray-500 hover:text-gray-700 w-4 text-sm"
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="w-4"></span>
        )}

        {/* Section name */}
        <span className="font-medium text-gray-900 flex-1">{section.name}</span>

        {/* Delete button */}
        <button
          onClick={() => onDelete(section.id)}
          className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity px-2"
          title="Delete folder"
        >
          ×
        </button>
      </div>

      {/* Children (if not collapsed) */}
      {!isCollapsed && (
        <>
          {/* Nested sections */}
          {hasChildren && section.children.map(child => {
            const childSection = allSections.find(s => s.id === child);
            return childSection ? (
              <DraggableSection
                key={child}
                section={childSection}
                depth={depth + 1}
                onDelete={onDelete}
                onToggleCollapse={onToggleCollapse}
                isCollapsed={isCollapsed}
                categories={categories}
                allSections={allSections}
              />
            ) : null;
          })}

          {/* Categories in this section */}
          {hasCategories && sectionCategories.map(cat => (
            <DraggableCategory
              key={cat.id}
              category={cat}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </>
      )}
    </div>
  );
}

// Draggable Category Component
function DraggableCategory({ category, onDelete, depth }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `category-${category.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: `${depth * 24}px`,
  };

  const keywords = Array.isArray(category.keywords)
    ? category.keywords
    : (category.keywords ? JSON.parse(category.keywords) : []);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-2 px-3 hover:bg-blue-50 rounded group border-l-2 border-transparent hover:border-blue-400"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 px-1"
        title="Drag to move"
      >
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5"/>
          <circle cx="9" cy="3" r="1.5"/>
          <circle cx="3" cy="8" r="1.5"/>
          <circle cx="9" cy="8" r="1.5"/>
          <circle cx="3" cy="13" r="1.5"/>
          <circle cx="9" cy="13" r="1.5"/>
        </svg>
      </button>

      <span className="w-4"></span>

      <span className="text-gray-900 flex-1 font-medium">{category.name}</span>
      <span className="text-xs text-gray-500 italic">
        {keywords.join(', ')}
      </span>
      <button
        onClick={() => onDelete(category.id, true)}
        className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity px-2"
        title="Delete category"
      >
        ×
      </button>
    </div>
  );
}

function CategoryTreeManagerDnD2() {
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Form states
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionParent, setNewSectionParent] = useState(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySection, setNewCategorySection] = useState(null);
  const [newCategoryKeywords, setNewCategoryKeywords] = useState('');

  // Collapsed state for folders
  const [collapsed, setCollapsed] = useState({});

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;

    try {
      await categoriesAPI.createSection(newSectionName, newSectionParent, 0);
      setMessage({ type: 'success', text: 'Folder created' });
      setNewSectionName('');
      setNewSectionParent(null);
      setShowSectionForm(false);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create folder' });
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !newCategoryKeywords.trim()) {
      setMessage({ type: 'error', text: 'Name and keywords required' });
      return;
    }

    try {
      const keywords = newCategoryKeywords.split(',').map(k => k.trim()).filter(k => k);
      await categoriesAPI.createCategory(newCategoryName, newCategorySection, keywords, 0);
      setMessage({ type: 'success', text: 'Category created' });
      setNewCategoryName('');
      setNewCategorySection(null);
      setNewCategoryKeywords('');
      setShowCategoryForm(false);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create category' });
    }
  };

  const handleDelete = async (id, isCategory = false) => {
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
      setMessage({ type: 'success', text: 'Deleted' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  const toggleCollapse = (sectionId) => {
    setCollapsed(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const activeType = active.id.toString().startsWith('section-') ? 'section' : 'category';
    const overType = over.id.toString().startsWith('section-') ? 'section' : 'category';

    const activeId = parseInt(active.id.toString().replace(/^(section|category)-/, ''));
    const overId = parseInt(over.id.toString().replace(/^(section|category)-/, ''));

    try {
      if (activeType === 'section' && overType === 'section') {
        // Moving a section into another section
        await categoriesAPI.updateSection(activeId, { parent_id: overId });
        setMessage({ type: 'success', text: 'Folder moved' });
      } else if (activeType === 'category' && overType === 'section') {
        // Moving a category into a section
        await categoriesAPI.updateCategory(activeId, { section_id: overId });
        setMessage({ type: 'success', text: 'Category moved' });
      }

      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to move' });
    }
  };

  // Flatten sections for dropdown
  const flattenSectionsForDropdown = (sectionList, depth = 0) => {
    let result = [];
    for (const section of sectionList) {
      result.push({ ...section, depth });
      if (section.children && section.children.length > 0) {
        result = result.concat(flattenSectionsForDropdown(section.children, depth + 1));
      }
    }
    return result;
  };

  // Flatten all sections for sortable context
  const flattenAllSections = (sectionList) => {
    let result = [];
    for (const section of sectionList) {
      result.push(section);
      if (section.children && section.children.length > 0) {
        result = result.concat(flattenAllSections(section.children));
      }
    }
    return result;
  };

  const rootCategories = categories.filter(c => c.section_id === null);
  const flatSections = flattenSectionsForDropdown(sections);
  const allSections = flattenAllSections(sections);

  // All sortable items
  const sortableItems = [
    ...sections.map(s => `section-${s.id}`),
    ...categories.map(c => `category-${c.id}`)
  ];

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Message */}
        {message && (
          <div className={`p-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowSectionForm(!showSectionForm);
              setShowCategoryForm(false);
            }}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium transition-colors"
          >
            {showSectionForm ? '× Cancel' : '+ New Folder'}
          </button>
          <button
            onClick={() => {
              setShowCategoryForm(!showCategoryForm);
              setShowSectionForm(false);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors"
          >
            {showCategoryForm ? '× Cancel' : '+ New Category'}
          </button>
        </div>

        {/* Create Section Form */}
        {showSectionForm && (
          <form onSubmit={handleCreateSection} className="p-4 border-2 border-yellow-200 rounded-lg bg-yellow-50">
            <h4 className="font-semibold text-gray-900 mb-3">New Folder</h4>
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              autoFocus
            />
            <select
              value={newSectionParent || ''}
              onChange={(e) => setNewSectionParent(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">Root level</option>
              {flatSections.map(section => (
                <option key={section.id} value={section.id}>
                  {'—'.repeat(section.depth)} {section.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
            >
              Create
            </button>
          </form>
        )}

        {/* Create Category Form */}
        {showCategoryForm && (
          <form onSubmit={handleCreateCategory} className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
            <h4 className="font-semibold text-gray-900 mb-3">New Category</h4>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <select
              value={newCategorySection || ''}
              onChange={(e) => setNewCategorySection(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Root level</option>
              {flatSections.map(section => (
                <option key={section.id} value={section.id}>
                  {'—'.repeat(section.depth)} {section.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newCategoryKeywords}
              onChange={(e) => setNewCategoryKeywords(e.target.value)}
              placeholder="Keywords (comma-separated)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-600 mb-3">
              Keywords are matched against calendar event titles
            </p>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              Create
            </button>
          </form>
        )}

        {/* Tree View */}
        <div className="border border-gray-200 rounded-lg bg-white">
          <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
            <div className="p-4">
              {sections.length === 0 && rootCategories.length === 0 && (
                <p className="text-gray-400 text-center py-12">
                  No categories yet
                </p>
              )}

              {sections.map(section => (
                <DraggableSection
                  key={section.id}
                  section={section}
                  depth={0}
                  onDelete={handleDelete}
                  onToggleCollapse={toggleCollapse}
                  isCollapsed={collapsed[section.id]}
                  categories={categories}
                  allSections={allSections}
                />
              ))}

              {rootCategories.map(cat => (
                <DraggableCategory
                  key={cat.id}
                  category={cat}
                  onDelete={handleDelete}
                  depth={0}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      </div>
    </DndContext>
  );
}

export default CategoryTreeManagerDnD2;
