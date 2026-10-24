import { h1, OTHER, NONE_COLOR } from '../utils/ledger';

export function Spark({ values, color, width = 90, height = 22 }) {
  const mx = Math.max(...values, 0) || 1;
  const bw = width / Math.max(values.length, 1);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="block">
      {values.map((v, i) => {
        const h = Math.max((v / mx) * height, v > 0 ? 1 : 0);
        return (
          <rect key={i} x={i * bw + 1} y={height - h} width={Math.max(bw - 2, 1)} height={h} rx="1"
            fill={i === values.length - 1 ? color : '#e4dccd'} />
        );
      })}
    </svg>
  );
}

export function SplitBar({ parts, total, height = 8 }) {
  return (
    <div className="flex overflow-hidden rounded bg-soft" style={{ height }}>
      {parts.filter(p => p.value > 0).map(p => (
        <i key={p.name} className="block h-full" title={`${p.name} ${h1(p.value)} h`}
          style={{ width: `${(p.value / (total || 1)) * 100}%`, background: p.color }} />
      ))}
    </div>
  );
}

// Section rows with a per-week spark, this week and the average of the weeks before;
// categories nest under their section.
export function Ledger({ keys, weeks, current, colorOf, showSub = true, nowLabel = 'now', avgLabel = 'avg' }) {
  const prev = weeks.slice(0, -1);
  const avg = (get) => prev.length ? prev.reduce((a, w) => a + get(w), 0) / prev.length : 0;
  const rows = [
    { name: 'total', get: (w) => w?.total || 0, color: '#2a2420' },
    ...keys.map(k => ({ name: k, get: (w) => w?.by[k] || 0, color: colorOf(k) })),
  ];
  const cols = 'grid grid-cols-[minmax(0,1fr)_64px_40px_40px] sm:grid-cols-[minmax(0,1fr)_90px_44px_44px] items-center gap-2';

  return (
    <div className="panel">
      <div className={`${cols} px-3.5 py-1.5 text-[11px] text-muted`}>
        <span /><span /><span className="text-right">{nowLabel}</span><span className="text-right">{avgLabel}</span>
      </div>
      {rows.map(r => {
        const subs = showSub && r.name !== 'total' ? (current?.cats || []).filter(c => c.key === r.name) : [];
        const uncat = showSub && r.name === OTHER ? current?.uncat || 0 : 0;
        return (
          <div key={r.name}>
            <div className={`${cols} px-3.5 py-2.5 border-t border-line text-sm ${r.name === 'total' ? 'font-semibold' : ''}`}>
              <span className="flex items-center gap-2 min-w-0">
                {r.name !== 'total' && <i className="dot" style={{ background: r.color }} />}
                <span className="truncate">{r.name}</span>
              </span>
              <Spark values={weeks.map(r.get)} color={r.color} />
              <span className="num text-right font-semibold">{h1(r.get(current))}</span>
              <span className="num text-right text-muted">{h1(avg(r.get))}</span>
            </div>
            {subs.map(c => (
              <div key={c.id} className={`${cols} px-3.5 py-1.5 text-[13px] text-muted`}>
                <span className="pl-4 truncate" title={c.section || ''}>{c.name}</span>
                <span /><span className="num text-right">{h1(c.hours)}</span><span />
              </div>
            ))}
            {uncat > 0.05 && (
              <div className={`${cols} px-3.5 py-1.5 text-[13px] text-muted`}>
                <span className="pl-4 italic">uncategorized</span>
                <span /><span className="num text-right">{h1(uncat)}</span><span />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Categories ranked by hours, bar against the largest.
export function CategoryBars({ summary, colorOf, extra }) {
  const cats = summary?.cats || [];
  const mx = Math.max(...cats.map(c => c.hours), summary?.uncat || 0, 0) || 1;
  const row = 'flex items-center gap-2 py-[7px] border-t border-line first:border-t-0 text-sm';
  return (
    <div>
      {cats.map(c => (
        <div key={c.id} className={row}>
          <i className="dot" style={{ background: colorOf(c.key) }} />
          <span className="truncate">{c.name}</span>
          {c.section && <span className="text-xs text-muted truncate">{c.section}</span>}
          <span className="ml-auto flex items-center gap-2 flex-none">
            {extra?.(c)}
            <span className="w-[90px] h-1.5 rounded bg-soft overflow-hidden hidden sm:block">
              <i className="block h-full" style={{ width: `${(c.hours / mx) * 100}%`, background: colorOf(c.key) }} />
            </span>
            <b className="num w-10 text-right">{h1(c.hours)}</b>
          </span>
        </div>
      ))}
      {summary?.uncat > 0.05 && (
        <div className={`${row} text-muted`}>
          <i className="dot" style={{ background: NONE_COLOR }} />
          uncategorized
          <span className="ml-auto flex items-center gap-2">
            <span className="w-[90px] h-1.5 rounded bg-soft overflow-hidden hidden sm:block">
              <i className="block h-full" style={{ width: `${(summary.uncat / mx) * 100}%`, background: NONE_COLOR }} />
            </span>
            <span className="num w-10 text-right">{h1(summary.uncat)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function Loading() {
  return <div className="py-12 text-center text-muted">…</div>;
}
