import { useEffect, useRef, useState } from 'react';
import { StaticTreeDataProvider, Tree, UncontrolledTreeEnvironment } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';
import { categoriesAPI } from '../services/api';
import { IoStar, IoStarOutline } from 'react-icons/io5';
import {
  ROOT_ID,
  TREE_ID,
  buildTreeItemsFromData,
  cloneItems,
  getCreateParentTreeId,
  getEntityParentId,
  getNextSectionName,
  getParentTreeId,
  insertAtIndex,
  normalizeKeywords,
  recalcDisplayOrder,
  removeItemAndDescendants,
  replaceItemsInPlace,
} from './categoryTreeUtils';

function TagBubble({ tag, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[7px] bg-soft px-2 py-0.5 text-[13px] text-ink">
      {tag}
      <button onClick={() => onRemove(tag)} className="text-muted hover:text-warn" title="Remove tag">
        ×
      </button>
    </span>
  );
}

function CategoryTree() {
  const environmentRef = useRef(null);
  const treeRef = useRef(null);
  const itemsRef = useRef(null);
  const dataProviderRef = useRef(null);
  const errorTimeoutRef = useRef(null);

  const [treeVersion, setTreeVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');

  const treeItems = itemsRef.current;
  const selectedItem = selectedItemId ? treeItems?.[selectedItemId] : null;
  const showTagPanel = selectedItem?.metadata?.type === 'category';

  useEffect(() => {
    loadData();

    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
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

  useEffect(() => {
    if (selectedItem?.metadata?.type === 'category') {
      setTags(normalizeKeywords(selectedItem.metadata.keywords));
    } else {
      setTags([]);
    }
  }, [selectedItem, treeVersion]);

  const normalizeTagList = (tagList) => {
    const seen = new Set();

    return tagList
      .map((tag) => tag?.trim())
      .filter((tag) => tag)
      .filter((tag) => {
        const normalizedTag = tag.toLowerCase();
        if (seen.has(normalizedTag)) {
          return false;
        }
        seen.add(normalizedTag);
        return true;
      });
  };

  const ensureCategoryNameTag = (tagList, categoryName) =>
    normalizeTagList([...(tagList ?? []), categoryName]);

  const getRenamedTreeItem = (item, name) => ({
    ...item,
    data: name,
    metadata:
      item.metadata?.type === 'category'
        ? {
            ...item.metadata,
            keywords: ensureCategoryNameTag(normalizeKeywords(item.metadata.keywords), name),
          }
        : item.metadata,
  });

  const showError = (text) => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }

    setErrorMessage(text);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMessage(null);
      errorTimeoutRef.current = null;
    }, 3000);
  };

  const emitChanges = (changedIds = [ROOT_ID]) => {
    if (!dataProviderRef.current) return;

    const validIds = changedIds.filter(Boolean);
    dataProviderRef.current.onDidChangeTreeDataEmitter.emit(validIds.length > 0 ? validIds : [ROOT_ID]);
  };

  const setItems = (nextItems, changedIds = [ROOT_ID]) => {
    if (!itemsRef.current) {
      itemsRef.current = nextItems;
    } else {
      replaceItemsInPlace(itemsRef.current, nextItems);
    }

    emitChanges(changedIds);
    setTreeVersion((current) => current + 1);
  };

  const loadData = async () => {
    try {
      const [sectionsData, categoriesData] = await Promise.all([
        categoriesAPI.listSections(),
        categoriesAPI.listCategories(),
      ]);

      const nextItems = buildTreeItemsFromData(
        sectionsData.sections ?? [],
        categoriesData.categories ?? []
      );

      if (!itemsRef.current) {
        itemsRef.current = nextItems;
      } else {
        replaceItemsInPlace(itemsRef.current, nextItems);
      }

      if (!dataProviderRef.current) {
        const provider = new StaticTreeDataProvider(itemsRef.current, (item, data) =>
          getRenamedTreeItem(item, data)
        );

        provider.onChangeItemChildren = async (parentTreeId, newChildren) => {
          const previousItems = cloneItems(itemsRef.current);
          const nextItems = {
            ...itemsRef.current,
            [parentTreeId]: {
              ...itemsRef.current[parentTreeId],
              children: newChildren,
            },
          };

          newChildren.forEach((childTreeId, index) => {
            const childItem = nextItems[childTreeId];
            if (!childItem?.metadata) return;

            nextItems[childTreeId] = {
              ...childItem,
              metadata: {
                ...childItem.metadata,
                parent_id:
                  childItem.metadata.type === 'section'
                    ? getEntityParentId(parentTreeId)
                    : childItem.metadata.parent_id,
                section_id:
                  childItem.metadata.type === 'category'
                    ? getEntityParentId(parentTreeId)
                    : childItem.metadata.section_id,
                display_order: index,
              },
            };
          });

          replaceItemsInPlace(itemsRef.current, nextItems);
          emitChanges([parentTreeId, ...newChildren]);
          setTreeVersion((current) => current + 1);

          try {
            await Promise.all(
              newChildren.map((childTreeId, index) => {
                const childItem = nextItems[childTreeId];
                if (!childItem?.metadata) return Promise.resolve();

                if (childItem.metadata.type === 'section') {
                  return categoriesAPI.updateSection(childItem.metadata.id, {
                    parent_id: getEntityParentId(parentTreeId),
                    display_order: index,
                  });
                }

                return categoriesAPI.updateCategory(childItem.metadata.id, {
                  section_id: getEntityParentId(parentTreeId),
                  display_order: index,
                });
              })
            );
          } catch (error) {
            replaceItemsInPlace(itemsRef.current, previousItems);
            emitChanges([parentTreeId, ...newChildren]);
            setTreeVersion((current) => current + 1);
            showError(error.response?.data?.error || 'Failed to move');
            throw error;
          }
        };

        dataProviderRef.current = provider;
      }

      emitChanges([ROOT_ID]);
      setTreeVersion((current) => current + 1);
    } catch (error) {
      console.error('Failed to load categories:', error);
      showError('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const persistOrderForParent = async (items, parentTreeId) => {
    if (!parentTreeId || !items[parentTreeId]) return;

    const parent = items[parentTreeId];
    for (let index = 0; index < parent.children.length; index += 1) {
      const item = items[parent.children[index]];
      if (!item?.metadata || item.metadata.display_order === index) continue;

      if (item.metadata.type === 'section') {
        await categoriesAPI.updateSection(item.metadata.id, { display_order: index });
      } else {
        await categoriesAPI.updateCategory(item.metadata.id, { display_order: index });
      }
    }
  };

  const handleRename = async (item, name) => {
    if (!treeItems?.[item.index]) return;

    const nextKeywords =
      item.metadata?.type === 'category'
        ? ensureCategoryNameTag(normalizeKeywords(item.metadata.keywords), name)
        : undefined;
    if (selectedItemId === item.index && nextKeywords) {
      setTags(nextKeywords);
    }

    try {
      if (item.metadata?.type === 'section') {
        await categoriesAPI.updateSection(item.metadata.id, { name });
      } else {
        await categoriesAPI.updateCategory(item.metadata.id, {
          name,
          keywords: nextKeywords,
        });
      }
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to rename');
      await loadData();
    }
  };

  const createTreeItem = async (type) => {
    if (!treeItems) return;

    const previousItems = cloneItems(treeItems);
    const selectedTreeId =
      environmentRef.current?.viewState?.[TREE_ID]?.selectedItems?.[0] ?? selectedItemId;
    const parentTreeId = getCreateParentTreeId(selectedTreeId, treeItems, type);
    const parentChildren = treeItems[parentTreeId]?.children ?? [];
    const tempTreeId = `temp-${type}-${Date.now()}`;
    const sectionName = type === 'section' ? getNextSectionName(treeItems) : null;
    const defaults =
      type === 'section'
        ? {
            data: sectionName,
            isFolder: true,
            metadata: {
              id: null,
              type: 'section',
              parent_id: getEntityParentId(parentTreeId),
              display_order: 0,
            },
          }
        : {
            data: 'New Category',
            isFolder: false,
            metadata: {
              id: null,
              type: 'category',
              keywords: [],
              section_id: getEntityParentId(parentTreeId),
              display_order: 0,
            },
          };

    const optimisticItems = {
      ...treeItems,
      [tempTreeId]: {
        index: tempTreeId,
        children: [],
        canMove: true,
        canRename: true,
        ...defaults,
      },
      [parentTreeId]: {
        ...treeItems[parentTreeId],
        children: insertAtIndex(parentChildren, tempTreeId, parentChildren.length),
      },
    };

    const reorderedItems = recalcDisplayOrder(optimisticItems, parentTreeId);
    setItems(reorderedItems, [parentTreeId, tempTreeId]);
    setSelectedItemId(tempTreeId);
    environmentRef.current?.selectItems([tempTreeId], TREE_ID);

    try {
      if (type === 'section') {
        const response = await categoriesAPI.createSection(
          sectionName,
          getEntityParentId(parentTreeId),
          0
        );
        const created = response.section;
        const createdTreeId = `section-${created.id}`;

        const committedItems = { ...reorderedItems };
        committedItems[createdTreeId] = {
          ...committedItems[tempTreeId],
          index: createdTreeId,
          data: created.name,
          metadata: {
            ...committedItems[tempTreeId].metadata,
            id: created.id,
            parent_id: created.parent_id,
            display_order: created.display_order ?? committedItems[tempTreeId].metadata.display_order,
          },
        };
        delete committedItems[tempTreeId];
        committedItems[parentTreeId] = {
          ...committedItems[parentTreeId],
          children: committedItems[parentTreeId].children.map((childTreeId) =>
            childTreeId === tempTreeId ? createdTreeId : childTreeId
          ),
        };

        const finalItems = recalcDisplayOrder(committedItems, parentTreeId);
        setItems(finalItems, [parentTreeId, createdTreeId]);
        setSelectedItemId(createdTreeId);
        environmentRef.current?.selectItems([createdTreeId], TREE_ID);
        startRenamingCreatedItem(createdTreeId);
        await persistOrderForParent(finalItems, parentTreeId);
        return;
      }

      const response = await categoriesAPI.createCategory(
        defaults.data,
        getEntityParentId(parentTreeId),
        defaults.metadata.keywords,
        0
      );
      const created = response.category;
      const createdTreeId = `category-${created.id}`;

      const committedItems = { ...reorderedItems };
      committedItems[createdTreeId] = {
        ...committedItems[tempTreeId],
        index: createdTreeId,
        data: created.name,
        metadata: {
          ...committedItems[tempTreeId].metadata,
          id: created.id,
          section_id: created.section_id,
          display_order: created.display_order ?? committedItems[tempTreeId].metadata.display_order,
        },
      };
      delete committedItems[tempTreeId];
      committedItems[parentTreeId] = {
        ...committedItems[parentTreeId],
        children: committedItems[parentTreeId].children.map((childTreeId) =>
          childTreeId === tempTreeId ? createdTreeId : childTreeId
        ),
      };

      const finalItems = recalcDisplayOrder(committedItems, parentTreeId);
      setItems(finalItems, [parentTreeId, createdTreeId]);
      setSelectedItemId(createdTreeId);
      environmentRef.current?.selectItems([createdTreeId], TREE_ID);
      startRenamingCreatedItem(createdTreeId);
      await persistOrderForParent(finalItems, parentTreeId);
    } catch (error) {
      setItems(previousItems, [parentTreeId]);
      showError(`Failed to create ${type === 'section' ? 'folder' : 'category'}`);
    }
  };

  const handleToggleCharts = async (treeId, event) => {
    event.stopPropagation();
    const item = treeItems?.[treeId];
    if (!item || item.metadata?.type !== 'section') return;
    try {
      await categoriesAPI.toggleSectionCharts(item.metadata.id);
      const nextItems = cloneItems(treeItems);
      nextItems[treeId] = {
        ...nextItems[treeId],
        metadata: { ...nextItems[treeId].metadata, show_in_charts: !nextItems[treeId].metadata.show_in_charts }
      };
      setItems(nextItems, [treeId]);
    } catch (e) {
      console.error('Failed to toggle charts', e);
    }
  };

  const handleDelete = async (treeId) => {
    if (!treeItems?.[treeId]?.metadata) return;

    const item = treeItems[treeId];
    const parentTreeId = getParentTreeId(item);
    const previousItems = cloneItems(treeItems);

    let nextItems = {
      ...treeItems,
      [parentTreeId]: {
        ...treeItems[parentTreeId],
        children: treeItems[parentTreeId].children.filter((childTreeId) => childTreeId !== treeId),
      },
    };

    nextItems = removeItemAndDescendants(nextItems, treeId);
    nextItems = recalcDisplayOrder(nextItems, parentTreeId);

    setItems(nextItems, [parentTreeId]);
    setSelectedItemId(parentTreeId === ROOT_ID ? null : parentTreeId);
    setPendingDeleteId(null);
    environmentRef.current?.selectItems(parentTreeId === ROOT_ID ? [] : [parentTreeId], TREE_ID);

    try {
      if (item.metadata.type === 'section') {
        await categoriesAPI.deleteSection(item.metadata.id);
      } else {
        await categoriesAPI.deleteCategory(item.metadata.id);
      }

      await persistOrderForParent(nextItems, parentTreeId);
    } catch (error) {
      setItems(previousItems, [parentTreeId, treeId]);
      showError(error.response?.data?.error || 'Failed to delete');
    }
  };

  const updateCategoryTags = async (nextTags, rollbackTags, errorText) => {
    if (!selectedItemId || !treeItems?.[selectedItemId]) return;

    const item = treeItems[selectedItemId];
    if (item.metadata?.type !== 'category') return;

    const previousItems = cloneItems(treeItems);
    const nextItems = {
      ...treeItems,
      [selectedItemId]: {
        ...item,
        metadata: {
          ...item.metadata,
          keywords: nextTags,
        },
      },
    };

    setTags(nextTags);
    setItems(nextItems, [selectedItemId]);

    try {
      await categoriesAPI.updateCategory(item.metadata.id, { keywords: nextTags });
    } catch (error) {
      setItems(previousItems, [selectedItemId]);
      setTags(rollbackTags);
      showError(errorText);
    }
  };

  const handleAddTag = async () => {
    const trimmedTag = newTag.trim();
    if (!trimmedTag || !selectedItemId || !treeItems?.[selectedItemId]) return;

    setNewTag('');
    await updateCategoryTags([...tags, trimmedTag], tags, 'Failed to add tag');
  };

  const handleRemoveTag = async (tagToRemove) => {
    await updateCategoryTags(
      tags.filter((tag) => tag !== tagToRemove),
      tags,
      'Failed to remove tag'
    );
  };

  const clearSelection = () => {
    setSelectedItemId(null);
    setPendingDeleteId(null);
    environmentRef.current?.selectItems([], TREE_ID);
  };

  const startRenamingCreatedItem = (treeId) => {
    setTimeout(() => {
      treeRef.current?.selectItems([treeId]);
      treeRef.current?.focusItem(treeId);
      treeRef.current?.startRenamingItem(treeId);
    }, 0);
  };

  const handleTreeAreaClick = (event) => {
    const clickTarget = event.target;
    if (!(clickTarget instanceof Element)) return;

    if (clickTarget.closest('[role="treeitem"]')) {
      return;
    }

    clearSelection();
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted">…</div>;
  }

  if (!treeItems || !dataProviderRef.current) {
    return <div className="py-8 text-center text-muted">—</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
      <div>
        {errorMessage && (
          <div className="mb-2 text-sm text-warn">{errorMessage}</div>
        )}

        <div>
          <div className="flex items-center gap-1.5 pb-2 border-b border-line">
            <button
              onClick={() => createTreeItem('section')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-soft px-2.5 py-1 text-muted hover:text-ink"
              title="New folder"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M10 4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6z" />
              </svg>
              <span className="text-[13px]">Folder</span>
            </button>

            <button
              onClick={() => createTreeItem('category')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-soft px-2.5 py-1 text-muted hover:text-ink"
              title="New category"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20 4H4a2 2 0 0 0-2 2v4h20V6a2 2 0 0 0-2-2zm0 8H2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6z" />
              </svg>
              <span className="text-[13px]">Category</span>
            </button>
          </div>

          <div
            className="pt-2"
            style={{ minHeight: '200px' }}
            onClick={handleTreeAreaClick}
          >
            {treeItems[ROOT_ID].children.length === 0 ? (
              <p className="py-12 text-center text-muted">—</p>
            ) : (
              <UncontrolledTreeEnvironment
                ref={environmentRef}
                dataProvider={dataProviderRef.current}
                getItemTitle={(item) => item.data}
                viewState={{}}
                canDragAndDrop
                canDropOnFolder
                canDropOnNonFolder={false}
                canReorderItems
                canRename
                onRenameItem={handleRename}
                renderTreeContainer={({ children, containerProps, info }) => (
                  <div
                    className={`rct-tree-root ${info.isFocused ? 'rct-tree-root-focus' : ''} ${
                      info.isRenaming ? 'rct-tree-root-renaming' : ''
                    } ${info.areItemsSelected ? 'rct-tree-root-itemsselected' : ''}`}
                  >
                    <div
                      {...containerProps}
                      style={containerProps.style}
                    >
                      {children}
                    </div>
                  </div>
                )}
                renderItemsContainer={({ children, containerProps }) => (
                  <ul
                    {...containerProps}
                    className="rct-tree-items-container"
                    style={containerProps.style}
                  >
                    {children}
                  </ul>
                )}
                onSelectItems={(itemIds) => {
                  setSelectedItemId(itemIds[0] ?? null);
                }}
                defaultInteractionMode={{
                  mode: 'custom',
                  extends: 'click-item-to-expand',
                  createInteractiveElementProps: (item, treeId, actions, renderFlags) => ({
                    onDoubleClick: (event) => {
                      event.stopPropagation();
                      if (item.canRename && !renderFlags.isRenaming) {
                        actions.startRenamingItem();
                      }
                    },
                  }),
                }}
              >
                <Tree
                  ref={treeRef}
                  treeId={TREE_ID}
                  rootItem={ROOT_ID}
                  treeLabel="Categories"
                  renderItemTitle={({ title, context, item }) => {
                    const showActions = context.isSelected && item.index !== ROOT_ID;

                    const isSection = item.metadata?.type === 'section';
                    const showInCharts = item.metadata?.show_in_charts;

                    return (
                      <div className="flex w-full items-center gap-2">
                        <span className="truncate">{title}</span>

                        {!context.isRenaming && (
                          <div className="relative ml-auto flex items-center gap-1">
                        {isSection && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => handleToggleCharts(item.index, e)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleToggleCharts(item.index, e); }}
                            className="flex-shrink-0 cursor-pointer p-1"
                            title={showInCharts ? 'Remove from charts' : 'Show in charts'}
                          >
                            {showInCharts
                              ? <IoStar size={13} className="text-gold" />
                              : <IoStarOutline size={13} className="text-line hover:text-gold" />
                            }
                          </span>
                        )}

                        {showActions && (
                          <div className="relative flex items-center gap-1">
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation();
                                setPendingDeleteId(item.index);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setPendingDeleteId(item.index);
                                }
                              }}
                              className="rounded-lg p-1 text-warn hover:bg-soft"
                              title="Delete"
                              aria-label="Delete"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M6 7h12l-1 14H7L6 7zm9-3l1 1h4v2H4V5h4l1-1h6z" />
                              </svg>
                            </span>

                            {pendingDeleteId === item.index && (
                              <div
                                className="absolute right-0 top-full z-10 mt-1 flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 shadow-lg"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="text-xs text-warn hover:underline cursor-pointer"
                                  onClick={() => handleDelete(item.index)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(item.index); }}
                                >
                                  Delete
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="text-xs text-muted hover:text-ink cursor-pointer"
                                  onClick={() => setPendingDeleteId(null)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') setPendingDeleteId(null); }}
                                >
                                  ✕
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                          </div>
                        )}
                      </div>
                    );
                  }}
                  renderRenameInput={({ formProps, inputProps, inputRef }) => {
                    const handleBlur = (event) => {
                      inputProps?.onBlur?.(event);

                      if (inputRef?.current?.form?.requestSubmit) {
                        inputRef.current.form.requestSubmit();
                      } else {
                        formProps?.onSubmit?.({
                          preventDefault: () => {},
                          stopPropagation: () => {},
                        });
                      }
                    };

                    return (
                      <form {...formProps}>
                        <input
                          {...inputProps}
                          ref={inputRef}
                          onBlur={handleBlur}
                          className="rounded border border-line bg-panel px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink/20"
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

      <div>
        <div className="lg:sticky lg:top-16 rounded-[10px] bg-oat/60 p-3 min-h-[60px]">
          {showTagPanel ? (
            <>
              <div className="mb-2 text-xs text-muted">{selectedItem?.data}</div>

              <div className="mb-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <TagBubble key={tag} tag={tag} onRemove={handleRemoveTag} />
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="tag"
                  className="field flex-1"
                />
                <button
                  onClick={handleAddTag}
                  className="rounded-lg bg-ink px-3 py-2 text-panel hover:bg-ink/90"
                  title="Add tag"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z" />
                  </svg>
                </button>
              </div>


            </>
          ) : (
            <div className="py-3 text-center text-muted text-xs" title="Select a category to edit its tags">tags</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CategoryTree;
