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
function DraggableSection({ section, depth, onDelete, onToggleCollapse, isCollapsed, categories, allSections, selectedId, onSelect }) {
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
  const isSelected = selectedId === `section-${section.id}`;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onClick={() => onSelect(`section-${section.id}`, section)}
        className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer transition-all ${
          isSelected
            ? 'bg-yellow-100 border-l-4 border-yellow-500'
            : 'hover:bg-gray-50 border-l-4 border-transparent hover:border-yellow-300'
        }`}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 px-1"
          onClick={(e) => e.stopPropagation()}
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
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(section.id);
            }}
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
          onClick={(e) => {
            e.stopPropagation();
            onDelete(section.id);
          }}
          className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity px-2"
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
                selectedId={selectedId}
                onSelect={onSelect}
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
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </div>
  );
}

// Draggable Category Component
function DraggableCategory({ category, onDelete, depth, selectedId, onSelect }) {
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

  const isSelected = selectedId === `category-${category.id}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(`category-${category.id}`, category)}
      className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer transition-all ${
        isSelected
          ? 'bg-blue-100 border-l-4 border-blue-500'
          : 'hover:bg-blue-50 border-l-4 border-transparent hover:border-blue-300'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 px-1"
        onClick={(e) => e.stopPropagation()}
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
        onClick={(e) => {
          e.stopPropagation();
          onDelete(category.id, true);
        }}
        className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity px-2"
      >
        ×
      </button>
    </div>
  );
}

function CategoryTreeManagerIntuitive() {
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Selection state
  const [selectedId, setSelectedId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Editing state
  const [editName, setEditName] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [editParent, setEditParent] = useState(null);

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

  const handleSelect = (id, item) => {
    setSelectedId(id);
    setSelectedItem(item);
    setEditName(item.name);

    if (id.startsWith('category-')) {
      const keywords = Array.isArray(item.keywords)
        ? item.keywords
        : (item.keywords ? JSON.parse(item.keywords) : []);
      setEditKeywords(keywords.join(', '));
      setEditParent(item.section_id);
    } else {
      setEditKeywords('');
      setEditParent(item.parent_id);
    }
  };

  const handleAddFolder = async () => {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;

    try {
      const parentId = selectedId?.startsWith('section-')
        ? parseInt(selectedId.replace('section-', ''))
        : null;

      await categoriesAPI.createSection(name, parentId, 0);
      setMessage({ type: 'success', text: 'Folder created' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create folder' });
    }
  };

  const handleAddCategory = async () => {
    const name = prompt('Category name:');
    if (!name?.trim()) return;

    const keywordsStr = prompt('Keywords (comma-separated):');
    if (!keywordsStr?.trim()) return;

    try {
      const keywords = keywordsStr.split(',').map(k => k.trim()).filter(k => k);
      const parentId = selectedId?.startsWith('section-')
        ? parseInt(selectedId.replace('section-', ''))
        : null;

      await categoriesAPI.createCategory(name, parentId, keywords, 0);
      setMessage({ type: 'success', text: 'Category created' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create category' });
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedId || !editName.trim()) return;

    try {
      if (selectedId.startsWith('section-')) {
        const sectionId = parseInt(selectedId.replace('section-', ''));
        await categoriesAPI.updateSection(sectionId, {
          name: editName,
          parent_id: editParent
        });
      } else {
        const categoryId = parseInt(selectedId.replace('category-', ''));
        const keywords = editKeywords.split(',').map(k => k.trim()).filter(k => k);
        await categoriesAPI.updateCategory(categoryId, {
          name: editName,
          section_id: editParent,
          keywords
        });
      }
      setMessage({ type: 'success', text: 'Saved' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save' });
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
      setSelectedId(null);
      setSelectedItem(null);
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
        await categoriesAPI.updateSection(activeId, { parent_id: overId });
        setMessage({ type: 'success', text: 'Folder moved' });
      } else if (activeType === 'category' && overType === 'section') {
        await categoriesAPI.updateCategory(activeId, { section_id: overId });
        setMessage({ type: 'success', text: 'Category moved' });
      }

      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to move' });
    }
  };

  // Flatten sections for dropdown
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

  // Flatten all sections
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
  const allSections = flattenAllSections(sections);

  // All sortable items
  const sortableItems = [
    ...sections.map(s => `section-${s.id}`),
    ...categories.map(c => `category-${c.id}`)
  ];

  const isFolder = selectedId?.startsWith('section-');
  const excludeId = isFolder && selectedItem ? selectedItem.id : null;
  const flatSections = flattenSectionsForDropdown(sections, 0, excludeId);

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Tree View */}
        <div className="col-span-2">
          {message && (
            <div className={`mb-4 p-3 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
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
                    selectedId={selectedId}
                    onSelect={handleSelect}
                  />
                ))}

                {rootCategories.map(cat => (
                  <DraggableCategory
                    key={cat.id}
                    category={cat}
                    onDelete={handleDelete}
                    depth={0}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        </div>

        {/* Right: Properties Panel */}
        <div className="col-span-1">
          <div className="border border-gray-200 rounded-lg bg-white p-4 sticky top-4">
            {selectedItem ? (
              <>
                <h3 className="font-semibold text-gray-900 mb-4">
                  {isFolder ? 'Folder Properties' : 'Category Properties'}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {!isFolder && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Keywords
                      </label>
                      <input
                        type="text"
                        value={editKeywords}
                        onChange={(e) => setEditKeywords(e.target.value)}
                        placeholder="comma, separated, keywords"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Matched against calendar event titles
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Parent
                    </label>
                    <select
                      value={editParent || ''}
                      onChange={(e) => setEditParent(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Root level</option>
                      {flatSections.map(section => (
                        <option key={section.id} value={section.id}>
                          {'—'.repeat(section.depth)} {section.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleSaveEdit}
                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                  >
                    Save Changes
                  </button>

                  <button
                    onClick={() => handleDelete(selectedItem.id, !isFolder)}
                    className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
                  >
                    Delete {isFolder ? 'Folder' : 'Category'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <p className="mb-2">Select an item to edit</p>
                <p className="text-sm">or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DndContext>
  );
}

export default CategoryTreeManagerIntuitive;
