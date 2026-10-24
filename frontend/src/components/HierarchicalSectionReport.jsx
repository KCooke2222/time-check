import { useState } from 'react';
import { h1, OTHER } from '../utils/ledger';

function HierarchicalSectionReport({ sectionHierarchy, reportType, colorOf }) {
  const [collapsed, setCollapsed] = useState({});
  const range = reportType === 'range';
  const cols = `grid ${range ? 'grid-cols-[minmax(0,1fr)_48px_32px_48px]' : 'grid-cols-[minmax(0,1fr)_48px]'} items-center gap-2`;

  const toggleCollapse = (sectionId) => {
    setCollapsed(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const renderSection = (section, depth = 0, key = null) => {
    const hasChildren = section.children && section.children.length > 0;
    const isCollapsed = collapsed[section.id];
    const k = key || (section.show_in_charts || section.id === 'other' ? section.name : null);

    return (
      <div key={section.id}>
        <div className={`${cols} py-2 border-t border-line text-sm ${depth === 0 ? '' : 'text-[13px] text-muted'}`}>
          <div className="flex items-center gap-2 min-w-0" style={{ paddingLeft: depth * 16 }}>
            {hasChildren ? (
              <button onClick={() => toggleCollapse(section.id)} className="text-muted text-[10px] w-3 flex-shrink-0">
                {isCollapsed ? '▶' : '▼'}
              </button>
            ) : (
              <span className="w-3 flex-shrink-0" />
            )}
            {k && <i className="dot" style={{ background: colorOf(k === 'other' ? OTHER : k) }} />}
            <span className={`truncate ${depth === 0 ? 'font-medium' : ''}`}>{section.name}</span>
          </div>
          <span className={`num text-right ${depth === 0 ? 'font-semibold' : ''}`}>{h1(section.total_raw_hours)}</span>
          {range && (
            <>
              <span className="num text-right text-muted text-xs">{section.weeks_present || 0}</span>
              <span className="num text-right text-muted">{h1(section.raw_hours_avg)}</span>
            </>
          )}
        </div>

        {!isCollapsed && hasChildren && section.children.map(child => renderSection(child, depth + 1, k))}
      </div>
    );
  };

  if (!sectionHierarchy || sectionHierarchy.length === 0) return null;

  return (
    <div>
      <div className={`${cols} text-[11px] text-muted pb-1`}>
        <span>Sections</span>
        <span className="text-right">h</span>
        {range && (<><span className="text-right" title="Weeks with time">wks</span><span className="text-right" title="Average per week">avg</span></>)}
      </div>
      {sectionHierarchy.map(section => renderSection(section, 0))}
    </div>
  );
}

export default HierarchicalSectionReport;
