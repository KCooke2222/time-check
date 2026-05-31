import { useState } from 'react';

function HierarchicalSectionReport({ sectionHierarchy, reportType }) {
  const [collapsed, setCollapsed] = useState({});

  const toggleCollapse = (sectionId) => {
    setCollapsed(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const renderSection = (section, depth = 0) => {
    const hasChildren = section.children && section.children.length > 0;
    const isCollapsed = collapsed[section.id];

    return (
      <div key={section.id}>
        <div className={`flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-gray-50 transition-colors ${depth > 0 ? 'ml-6' : ''}`}>
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button onClick={() => toggleCollapse(section.id)} className="text-gray-400 hover:text-gray-600 text-xs w-4 flex-shrink-0">
                {isCollapsed ? '▶' : '▼'}
              </button>
            ) : (
              <span className="w-4 flex-shrink-0" />
            )}
            <span className={`font-medium truncate ${depth === 0 ? 'text-gray-900' : 'text-gray-600 text-sm'}`}>
              {section.name}
            </span>
          </div>

          <div className="flex items-center gap-6 flex-shrink-0 ml-4">
            <span className={`font-semibold tabular-nums ${depth === 0 ? 'text-gray-900' : 'text-gray-500 text-sm'}`}>
              {section.total_raw_hours.toFixed(1)}h
            </span>
            {reportType === 'range' && (
              <>
                <span className="text-gray-400 text-sm tabular-nums w-12 text-right">{section.weeks_present || 0}w</span>
                <span className="text-gray-400 text-sm tabular-nums w-16 text-right">{(section.raw_hours_avg || 0).toFixed(1)}h/w</span>
              </>
            )}
          </div>
        </div>

        {!isCollapsed && hasChildren && (
          <div>
            {section.children.map(child => renderSection(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!sectionHierarchy || sectionHierarchy.length === 0) {
    return <div className="text-center py-8 text-gray-400 text-sm">No section data available</div>;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-1 px-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">By Section</p>
        {reportType === 'range' && (
          <div className="flex gap-6 text-xs text-gray-400 uppercase tracking-wide pr-1">
            <span className="w-12 text-right">Weeks</span>
            <span className="w-16 text-right">Avg</span>
          </div>
        )}
      </div>
      <div>
        {sectionHierarchy.map(section => renderSection(section, 0))}
      </div>
    </div>
  );
}

export default HierarchicalSectionReport;
