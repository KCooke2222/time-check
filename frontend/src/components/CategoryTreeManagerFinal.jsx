import { useState, useEffect, useRef } from 'react';
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

// Inline editable name component
function EditableName({ value, onSave, isFolder }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue.trim() && editValue !== value) {
      onSave(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
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
    );
  }

  return (
    <span
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className="flex-1 cursor-text"
      title="Double-click to rename"
    >
      {value}
    </span>
  );
}

// Draggable Section Component
function DraggableSection({
  section,
  depth,
  onDelete,
  onToggleCollapse,
  isCollapsed,
  categories,
  allSections,
  selectedId,
  onSelect,
  onUpdateName,
  creatingIn,
  collapsed
}) {
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
        onClick={() => onSelect(`section-${section.id}`, section, true)}
        className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer transition-all group ${
          isSelected
            ? 'bg-yellow-100 border-l-4 border-yellow-500'
            : 'hover:bg-gray-50 border-l-4 border-transparent hover:border-yellow-300'
        }`}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
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

        {/* Section name - editable */}
        <EditableName
          value={section.name}
          onSave={(newName) => onUpdateName(section.id, newName, true)}
          isFolder={true}
        />

        {/* Delete button (trash icon) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(section.id, false);
          }}
          className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity px-1"
          title="Delete folder"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.5a.5.5 0 0 0 0 1h.79l.812 10.56A1.5 1.5 0 0 0 5.6 15h4.8a1.5 1.5 0 0 0 1.498-1.44L12.71 3.5h.79a.5.5 0 0 0 0-1H11Z"/>
          </svg>
        </button>
      </div>

      {/* Children (if not collapsed) */}
      {!isCollapsed && (
        <>
          {/* Nested sections */}
          {hasChildren && section.children.map(childSection => (
            <DraggableSection
              key={childSection.id}
              section={childSection}
              depth={depth + 1}
              onDelete={onDelete}
              onToggleCollapse={onToggleCollapse}
              isCollapsed={collapsed[childSection.id]}
              categories={categories}
              allSections={allSections}
              selectedId={selectedId}
              onSelect={onSelect}
              onUpdateName={onUpdateName}
              creatingIn={creatingIn}
              collapsed={collapsed}
            />
          ))}

          {/* Categories in this section */}
          {hasCategories && sectionCategories.map(cat => (
            <DraggableCategory
              key={cat.id}
              category={cat}
              onDelete={onDelete}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onUpdateName={onUpdateName}
            />
          ))}
        </>
      )}
    </div>
  );
}

// Draggable Category Component
function DraggableCategory({ category, onDelete, depth, selectedId, onSelect, onUpdateName }) {
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

  const isSelected = selectedId === `category-${category.id}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(`category-${category.id}`, category, false)}
      className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer transition-all group ${
        isSelected
          ? 'bg-blue-100 border-l-4 border-blue-500'
          : 'hover:bg-blue-50 border-l-4 border-transparent hover:border-blue-300'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
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

      <span className="w-4"></span>

      {/* Category name - editable */}
      <EditableName
        value={category.name}
        onSave={(newName) => onUpdateName(category.id, newName, false)}
        isFolder={false}
      />

      {/* Delete button (trash icon) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(category.id, true);
        }}
        className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity px-1"
        title="Delete category"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.5a.5.5 0 0 0 0 1h.79l.812 10.56A1.5 1.5 0 0 0 5.6 15h4.8a1.5 1.5 0 0 0 1.498-1.44L12.71 3.5h.79a.5.5 0 0 0 0-1H11Z"/>
        </svg>
      </button>
    </div>
  );
}

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

function CategoryTreeManagerFinal() {
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // Selection state
  const [selectedId, setSelectedId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isFolder, setIsFolder] = useState(false);

  // Tag editing
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const tagInputRef = useRef(null);

  // Collapsed state
  const [collapsed, setCollapsed] = useState({});

  // Creating state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15, // Increased from 8 to make it less finicky
        delay: 100,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedItem && !isFolder) {
      const keywords = Array.isArray(selectedItem.keywords)
        ? selectedItem.keywords
        : (selectedItem.keywords ? JSON.parse(selectedItem.keywords) : []);
      setTags(keywords);
    }
  }, [selectedItem, isFolder]);

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

  const handleSelect = (id, item, folder) => {
    setSelectedId(id);
    setSelectedItem(item);
    setIsFolder(folder);
  };

  const handleUpdateName = async (id, newName, folder) => {
    try {
      if (folder) {
        await categoriesAPI.updateSection(id, { name: newName });
      } else {
        await categoriesAPI.updateCategory(id, { name: newName });
      }
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update name' });
    }
  };

  const handleAddFolder = async () => {
    const parentId = selectedId?.startsWith('section-')
      ? parseInt(selectedId.replace('section-', ''))
      : null;

    // Generate unique name
    const timestamp = Date.now();
    const name = `New Folder ${timestamp}`;

    try {
      const result = await categoriesAPI.createSection(name, parentId, 0);
      await loadData();
      setSelectedId(`section-${result.section.id}`);
      // Focus will be handled by the component rendering
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create folder' });
    }
  };

  const handleAddCategory = async () => {
    const parentId = selectedId?.startsWith('section-')
      ? parseInt(selectedId.replace('section-', ''))
      : null;

    // Generate unique name
    const timestamp = Date.now();
    const name = `New Category ${timestamp}`;

    try {
      const result = await categoriesAPI.createCategory(name, parentId, [], 0);
      await loadData();
      setSelectedId(`category-${result.category.id}`);
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
      } else if (activeType === 'category' && overType === 'section') {
        await categoriesAPI.updateCategory(activeId, { section_id: overId });
      }
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to move' });
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !selectedItem || isFolder) return;

    const newTags = [...tags, newTag.trim()];
    setTags(newTags);
    setNewTag('');

    try {
      const categoryId = parseInt(selectedId.replace('category-', ''));
      await categoriesAPI.updateCategory(categoryId, { keywords: newTags });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add tag' });
      setTags(tags); // Rollback
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    const newTags = tags.filter(t => t !== tagToRemove);
    setTags(newTags);

    try {
      const categoryId = parseInt(selectedId.replace('category-', ''));
      await categoriesAPI.updateCategory(categoryId, { keywords: newTags });
      await loadData();
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

  const rootCategories = categories.filter(c => !c.section_id);
  const allSections = flattenAllSections(sections);
  const sortableItems = [
    ...sections.map(s => `section-${s.id}`),
    ...categories.map(c => `category-${c.id}`)
  ];

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                    onUpdateName={handleUpdateName}
                    collapsed={collapsed}
                  />
                ))}

                {/* Root-level categories */}
                {rootCategories.map(cat => (
                  <DraggableCategory
                    key={cat.id}
                    category={cat}
                    onDelete={handleDelete}
                    depth={0}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    onUpdateName={handleUpdateName}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        </div>

        {/* Right: Properties Panel */}
        <div className="col-span-1">
          <div className="border border-gray-200 rounded-lg bg-white p-4 sticky top-4">
            {selectedItem && !isFolder ? (
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
    </DndContext>
  );
}

export default CategoryTreeManagerFinal;
