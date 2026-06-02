export const TREE_ID = 'category-tree';
export const ROOT_ID = 'root';

export const normalizeKeywords = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const cloneItems = (items) => JSON.parse(JSON.stringify(items));

export const buildTreeItemsFromData = (sections, categories) => {
  const items = {
    [ROOT_ID]: {
      index: ROOT_ID,
      isFolder: true,
      children: [],
      data: 'Root',
      canMove: false,
      canRename: false,
    },
  };

  const sectionsByParent = new Map();
  const registerSections = (sectionList) => {
    sectionList.forEach((section) => {
      const key = section.parent_id ?? ROOT_ID;
      const existing = sectionsByParent.get(key) ?? [];
      existing.push(section);
      sectionsByParent.set(key, existing);

      if (Array.isArray(section.children) && section.children.length > 0) {
        registerSections(section.children);
      }
    });
  };

  registerSections(sections);

  const categoriesBySection = new Map();
  categories.forEach((category) => {
    const key = category.section_id ?? ROOT_ID;
    const existing = categoriesBySection.get(key) ?? [];
    existing.push(category);
    categoriesBySection.set(key, existing);
  });

  categoriesBySection.forEach((list) => {
    list.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  });

  const buildSection = (section) => {
    const sectionTreeId = `section-${section.id}`;
    items[sectionTreeId] = {
      index: sectionTreeId,
      isFolder: true,
      children: [],
      data: section.name,
      canMove: true,
      canRename: true,
      metadata: {
        id: section.id,
        type: 'section',
        parent_id: section.parent_id ?? null,
        display_order: section.display_order ?? 0,
        show_in_charts: section.show_in_charts ?? false,
      },
    };
    return sectionTreeId;
  };

  categories.forEach((category) => {
    const categoryTreeId = `category-${category.id}`;
    items[categoryTreeId] = {
      index: categoryTreeId,
      isFolder: false,
      children: [],
      data: category.name,
      canMove: true,
      canRename: true,
      metadata: {
        id: category.id,
        type: 'category',
        keywords: normalizeKeywords(category.keywords),
        section_id: category.section_id,
        display_order: category.display_order ?? 0,
      },
    };
  });

  const assignChildren = (parentTreeId, parentEntityId = ROOT_ID) => {
    const childSections = (sectionsByParent.get(parentEntityId) ?? []).map((section) => ({
      treeId: buildSection(section),
      display_order: section.display_order ?? 0,
    }));
    const childCategories = (categoriesBySection.get(parentEntityId) ?? []).map((category) => ({
      treeId: `category-${category.id}`,
      display_order: category.display_order ?? 0,
    }));

    items[parentTreeId].children = [...childSections, ...childCategories]
      .sort((a, b) => a.display_order - b.display_order)
      .map((child) => child.treeId);

    childSections.forEach(({ treeId }) => {
      const sectionId = Number(treeId.replace('section-', ''));
      assignChildren(treeId, sectionId);
    });
  };

  assignChildren(ROOT_ID, ROOT_ID);

  return items;
};

export const replaceItemsInPlace = (target, source) => {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });
  Object.entries(source).forEach(([key, value]) => {
    target[key] = value;
  });
};

export const getParentTreeId = (item) => {
  if (!item?.metadata) return ROOT_ID;

  if (item.metadata.type === 'section') {
    return item.metadata.parent_id ? `section-${item.metadata.parent_id}` : ROOT_ID;
  }

  if (item.metadata.type === 'category') {
    return item.metadata.section_id ? `section-${item.metadata.section_id}` : ROOT_ID;
  }

  return ROOT_ID;
};

export const getEntityParentId = (treeId) => {
  if (!treeId || treeId === ROOT_ID) return null;
  return Number(treeId.replace('section-', ''));
};

export const recalcDisplayOrder = (items, parentTreeId) => {
  const parent = items[parentTreeId];
  if (!parent) return items;

  const nextItems = { ...items };

  parent.children.forEach((childTreeId, index) => {
    const child = nextItems[childTreeId];
    if (!child?.metadata) return;
    nextItems[childTreeId] = {
      ...child,
      metadata: { ...child.metadata, display_order: index },
    };
  });

  return nextItems;
};

export const removeItemAndDescendants = (items, treeId) => {
  const nextItems = { ...items };
  const queue = [treeId];

  while (queue.length > 0) {
    const currentTreeId = queue.pop();
    const currentItem = nextItems[currentTreeId];

    if (currentItem?.children?.length) {
      currentItem.children.forEach((childTreeId) => queue.push(childTreeId));
    }

    delete nextItems[currentTreeId];
  }

  return nextItems;
};

export const insertAtIndex = (children, treeId, index) => {
  const nextChildren = children.slice();
  nextChildren.splice(index, 0, treeId);
  return nextChildren;
};

export const isDescendantSection = (items, candidateParentTreeId, sourceSectionTreeId) => {
  if (!candidateParentTreeId || candidateParentTreeId === ROOT_ID) return false;

  let currentTreeId = candidateParentTreeId;
  while (currentTreeId && currentTreeId !== ROOT_ID) {
    if (currentTreeId === sourceSectionTreeId) {
      return true;
    }

    const currentItem = items[currentTreeId];
    if (currentItem?.metadata?.type !== 'section') {
      break;
    }

    currentTreeId = currentItem.metadata.parent_id
      ? `section-${currentItem.metadata.parent_id}`
      : ROOT_ID;
  }

  return false;
};

export const getCreateParentTreeId = (selectedTreeId, items, type) => {
  if (!selectedTreeId || selectedTreeId === ROOT_ID || !items[selectedTreeId]) {
    return ROOT_ID;
  }

  const selectedItem = items[selectedTreeId];

  if (type === 'section') {
    return selectedItem.metadata?.type === 'section'
      ? selectedTreeId
      : getParentTreeId(selectedItem);
  }

  if (type === 'category') {
    return selectedItem.metadata?.type === 'section'
      ? selectedTreeId
      : getParentTreeId(selectedItem);
  }

  return ROOT_ID;
};

export const getNextSectionName = (items, baseName = 'New Folder') => {
  const existingNames = new Set(
    Object.values(items)
      .filter((item) => item?.metadata?.type === 'section')
      .map((item) => item.data)
  );

  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) {
    counter += 1;
  }

  return `${baseName} ${counter}`;
};
