import { useState } from 'react';

/**
 * Whose numbers a performance leaderboard reports. The rows are always the
 * viewer's direct reports, one row each; the filter only changes what each
 * row counts:
 *
 *   Individual  that manager's own work, nobody under them (the server's `own`)
 *   Teams       everyone under that manager, without the manager (`teamOnly`)
 *   All         the two combined (the server's `rollupMetrics`)
 *
 * So a State Manager sees their Industry Managers under every filter: their own
 * leads, their district managers' leads, or both. Individual + Teams = All.
 *
 * Shared by the Founder, State Manager and Industry Manager performance pages
 * so the filter means the same thing and stays labelled the same way.
 */
export const SCOPE_TABS = [
  { key: 'teams',      label: 'Teams',      hint: 'each manager’s team, without the manager' },
  { key: 'individual', label: 'Individual', hint: 'each manager’s own work only' },
  { key: 'all',        label: 'All',        hint: 'each manager and their team combined' }
];

/** A row's metrics for the scope, from the server's own / teamOnly / rolled-up lines. */
export const scopedMetrics = (row, scope) => {
  if (scope === 'individual') return row.own || {};
  if (scope === 'teams') return row.teamOnly || {};
  return row;
};

export const scopeHint = (scope) => SCOPE_TABS.find(t => t.key === scope)?.hint || '';

/** Scope state, starting on `initial` ('teams' | 'individual' | 'all'). */
export const usePerfScope = (initial = 'teams') => {
  const [scope, setScope] = useState(initial);
  return { scope, setScope };
};

export const PerfScopeTabs = ({ scope, setScope }) => (
  <div className="flex bg-surface2 p-1 rounded-xl border border-border">
    {SCOPE_TABS.map(t => (
      <button
        key={t.key}
        onClick={() => setScope(t.key)}
        title={t.hint}
        className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-widest rounded-lg transition-all ${scope === t.key ? 'bg-surface text-purple shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
      >
        {t.label}
      </button>
    ))}
  </div>
);

export default PerfScopeTabs;
