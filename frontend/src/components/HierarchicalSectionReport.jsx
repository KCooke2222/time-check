import { useState } from 'react';

function HierarchicalSectionReport({ sectionHierarchy, reportType }) {
  const [collapsed, setCollapsed] = useState({});

  const toggleCollapse = (sectionId) => {
    setCollapsed(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const renderSection = (section, depth = 0, allSections = {}) => {
    if (depth === 0) {
      const buildMap = (sections, map = {}) => {
        sections.forEach(s => {
          map[s.id] = s;
          if (s.children && s.children.length > 0) {
            s.children.forEach(childId => {
              const childSection = sections.find(sec => sec.id === childId);
              if (childSection) map[childId] = childSection;
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
    const childSections = hasChildren
      ? section.children.map(childId => allSections[childId]).filter(Boolean)
      : [];

    return (
      <div key={section.id}>
        <div className={`flex items-center hover:bg-gray-50 py-2 ${depth > 0 ? 'border-l-2 border-gray-200' : ''}`}>
          <div className={`flex items-center flex-1 ${indentClass} px-6`}>
            {hasChildren ? (
              <button onClick={() => toggleCollapse(section.id)} className="text-gray-500 hover:text-gray-700 w-6 mr-2">
                {isCollapsed ? '▶' : '▼'}
              </button>
            ) : (
              <span className="w-6 mr-2"></span>
            )}
            <span className="text-yellow-600 mr-2">📁</span>
            <span className="font-medium text-gray-900">{section.name}</span>
            {section.direct_raw_hours > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                (direct: {section.direct_raw_hours.toFixed(1)}h)
              </span>
            )}
          </div>
          <div className="px-6 py-2 text-sm text-gray-700 font-medium text-right w-32">
            {section.total_raw_hours.toFixed(2)}h
          </div>
          {reportType === 'range' && (
            <>
              <div className="px-6 py-2 text-sm text-gray-600 text-right w-24">
                {section.weeks_present || 0}
              </div>
              <div className="px-6 py-2 text-sm text-gray-600 text-right w-32">
                {(section.raw_hours_avg || 0).toFixed(2)}h
              </div>
            </>
          )}
        </div>
        {!isCollapsed && hasChildren && (
          <div>
            {childSections.map(child => renderSection(child, depth + 1, allSections))}
          </div>
        )}
      </div>
    );
  };

  if (!sectionHierarchy || sectionHierarchy.length === 0) {
    return <div className="text-center py-8 text-gray-500">No section data available</div>;
  }

  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-gray-800 mb-3">By Section</h4>
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 flex items-center font-medium text-xs text-gray-500 uppercase">
          <div className="flex-1 px-6 py-3">Section</div>
          <div className="px-6 py-3 text-right w-32">Hours</div>
          {reportType === 'range' && (
            <>
              <div className="px-6 py-3 text-right w-24">Weeks</div>
              <div className="px-6 py-3 text-right w-32">Avg/Week</div>
            </>
          )}
        </div>
        <div>
          {sectionHierarchy.map(section => renderSection(section, 0))}
        </div>
      </div>
    </div>
  );
}

export default HierarchicalSectionReport;
