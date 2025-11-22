/**
 * Sort categories by section_id (grouped together), then alphabetically by name
 * Categories with sections appear first, sorted by section_id, then by name.
 * Categories without sections appear last, sorted alphabetically by name.
 * @param {Array} categoryEntries - Array of [id, data] tuples from Object.entries()
 * @returns {Array} Sorted array of [id, data] tuples
 */
export const sortCategoriesBySection = (categoryEntries) => {
  return categoryEntries.sort(([, a], [, b]) => {
    const sectionA = a.section_id;
    const sectionB = b.section_id;

    // Items without sections go to the end
    if (sectionA == null && sectionB == null) {
      // Both have no section - sort alphabetically by name
      return a.name.localeCompare(b.name);
    }
    if (sectionA == null) {
      // a has no section, b has section - b comes first
      return 1;
    }
    if (sectionB == null) {
      // a has section, b has no section - a comes first
      return -1;
    }

    // Both have sections - sort by section_id first
    if (sectionA !== sectionB) {
      return sectionA - sectionB;
    }

    // Same section - sort alphabetically by name
    return a.name.localeCompare(b.name);
  });
};