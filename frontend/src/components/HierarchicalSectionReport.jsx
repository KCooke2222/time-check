import { useState } from 'react';

function HierarchicalSectionReport({ sectionHierarchy, reportType }) {
  const [collapsed, setCollapsed] = useState({});

  const toggleCollapse = (sectionId) => {
    setCollapsed(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Recursively render section and its children
  const renderSection = (section, depth = 0, allSections = {}) => {
    // Build a map of all sections for quick lookup
    if (depth === 0) {
      const buildMap = (sections, map = {}) => {
        sections.forEach(s => {
          map[s.id] = s;
          if (s.children && s.children.length > 0) {
            s.children.forEach(childId => {
              const childSection = sections.find(sec => sec.id === childId);
              if (childSection) {
                map[childId] = childSection;
              }
            });
          }
        });
        return map;
      };
      allSections = buildMap(sectionHierarchy);
    }

    const hasChildren = section.children && section.children.length > 0;
    const isCollapsed = collapsed[section.id];
    const indentClass = `pl-${depth * 6}`;

    // Get child sections
    const childSections = hasChildren
      ? section.children.map(childId => allSections[childId]).filter(Boolean)
      : [];

    return (
      <div key={section.id}>
        {/* Section row */}
        <div className={`flex items-center hover:bg-gray-50 py-2 ${depth > 0 ? 'border-l-2 border-gray-200' : ''}`}>
          <div className={`flex items-center flex-1 ${indentClass} px-6`}>
            {/* Collapse/expand button */}
            {hasChildren ? (
              <button
                onClick={() => toggleCollapse(section.id)}
                className="text-gray-500 hover:text-gray-700 w-6 mr-2"
              >
                {isCollapsed ? '▶' : '▼'}
              </button>
            ) : (
              <span className="w-6 mr-2"></span>
            )}

            {/* Folder icon and name */}
            <span className="text-yellow-600 mr-2">📁</span>
            <span className="font-medium text-gray-900">{section.name}</span>

            {/* Show direct vs total hours indicator */}
            {section.direct_raw_hours > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                (direct: {section.direct_intensity_hours.toFixed(1)}h)
              </span>
            )}
          </div>

          {/* Hours columns */}
          <div className="px-6 py-2 text-sm text-gray-600 text-right w-32">
            {section.total_raw_hours.toFixed(2)}h
          </div>
          <div className="px-6 py-2 text-sm text-blue-600 font-semibold text-right w-32">
            {section.total_intensity_hours.toFixed(2)}h
          </div>

          {/* Range report columns */}
          {reportType === 'range' && (
            <>
              <div className="px-6 py-2 text-sm text-gray-600 text-right w-24">
                {section.weeks_present || 0}
              </div>
              <div className="px-6 py-2 text-sm text-gray-600 text-right w-32">
                {(section.intensity_hours_avg || 0).toFixed(2)}h
              </div>
            </>
          )}
        </div>

        {/* Child sections (if not collapsed) */}
        {!isCollapsed && hasChildren && (
          <div>
            {childSections.map(child => renderSection(child, depth + 1, allSections))}
          </div>
        )}
      </div>
    );
  };

  if (!sectionHierarchy || sectionHierarchy.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No section data available
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-gray-800 mb-3">By Section (Hierarchical)</h4>
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 flex items-center font-medium text-xs text-gray-500 uppercase">
          <div className="flex-1 px-6 py-3">Section</div>
          <div className="px-6 py-3 text-right w-32">Raw Hours</div>
          <div className="px-6 py-3 text-right w-32">Intensity Hours</div>
          {reportType === 'range' && (
            <>
              <div className="px-6 py-3 text-right w-24">Weeks</div>
              <div className="px-6 py-3 text-right w-32">Avg/Week</div>
            </>
          )}
        </div>

        {/* Sections tree */}
        <div>
          {sectionHierarchy.map(section => renderSection(section, 0))}
        </div>
      </div>

      <div className="mt-3 text-sm text-gray-600">
        <p>💡 <strong>Total hours</strong> include all child sections. <strong>Direct hours</strong> are shown in parentheses when a section has its own trackable categories.</p>
      </div>
    </div>
  );
}

export default HierarchicalSectionReport;
