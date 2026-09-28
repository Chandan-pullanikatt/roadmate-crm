import { useState } from 'react';

/**
 * Whose numbers a performance leaderboard reports.
 *
 * A **team** row is a manager rolled up with everyone reporting to them (the
 * server's `rollupMetrics`). A **personal** row is one person's own work,
 * counted on its own. Under **All** both are listed, so the same manager
 * appears twice — every row carries a `subLabel` under the name saying which
 * line is which, so the two are never read as a double count.
 *
 * Shared by the State Manager and Industry Manager performance pages so the two
 * filters mean the same thing and stay labelled the same way.
 */
export const SCOPE_TABS = [
  { key: 'teams',    label: 'Teams',    hint: 'rolled up with everyone reporting to them' },
  { key: 'personal', label: 'Personal', hint: 'each person’s own work, counted on its own' },
  { key: 'all',      label: 'All',      hint: 'team rollups and personal lines together' }
];

export const scopeHint = (scope) => SCOPE_TABS.find(t => t.key === scope)?.hint || '';

/** Scope state, starting on `initial` ('teams' | 'personal' | 'all'). */
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
