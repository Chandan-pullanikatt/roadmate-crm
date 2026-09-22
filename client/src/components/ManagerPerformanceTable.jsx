import React, { useMemo, useState } from 'react';

/**
 * The one staff/manager performance table used across the CRM.
 *
 * Every place that lists managers — the Founder's State Managers, Industry
 * Managers, District Managers and leaderboard, the State Manager's own lists,
 * the Industry Manager's district list and the drill-in profiles — renders this,
 * so the columns and the formatting never drift apart again:
 *
 *   Manager · State · Industry · Work % · Leads · Direct Meetings ·
 *   Virtual Meetings · Blockings · Revenue · Actions
 *
 * Every figure comes from the server's performanceService, so the same person
 * shows the same numbers whichever dashboard is looking at them.
 */

/** Column order, header text and the row field each one reads. */
const COLUMNS = [
  { key: 'name', label: 'Manager', align: 'left' },
  { key: 'state', label: 'State', align: 'center' },
  { key: 'industry', label: 'Industry', align: 'left' },
  { key: 'workPct', label: 'Work %', align: 'center' },
  { key: 'periodLeads', label: 'Leads', align: 'center' },
  { key: 'directMeetings', label: <>Direct<br />Meetings</>, align: 'center' },
  { key: 'virtualMeetings', label: <>Virtual<br />Meetings</>, align: 'center' },
  { key: 'blocking', label: 'Blockings', align: 'center' },
  { key: 'revenue', label: 'Revenue', align: 'center' }
];

/** Rupee short form: lakhs above 1L, grouped digits below. */
export const formatRevenue = (val = 0) =>
  `₹${val >= 100000 ? (val / 100000).toFixed(1) + 'L' : (val || 0).toLocaleString()}`;

const workBarColor = (pct) =>
  pct >= 80 ? 'bg-[#0f766e]' : pct >= 60 ? 'bg-[#ea580c]' : 'bg-[#dc2626]';

export const WorkPctCell = ({ value = 0 }) => (
  <div className="flex items-center gap-2 justify-center">
    <div className="w-8 h-1.5 bg-surface2 rounded-full overflow-hidden">
      <div className={`h-full ${workBarColor(value)}`} style={{ width: `${Math.min(value, 100)}%` }}></div>
    </div>
    <span className="font-bold text-[12px]">{value}%</span>
  </div>
);

const SortIcon = ({ active, dir }) => (
  <span className="ml-1 inline-flex flex-col gap-px" style={{ opacity: active ? 1 : 0.35 }}>
    <span style={{ borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderBottom: active && dir === 'asc' ? '4px solid currentColor' : '4px solid transparent', display: 'block' }} />
    <span style={{ borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderTop: active && dir === 'desc' ? '4px solid currentColor' : '4px solid transparent', display: 'block' }} />
  </span>
);

/**
 * @param {Array}    rows           one object per person; missing metrics render as 0
 * @param {Function} renderActions  (row) => node, rendered in the Actions cell
 * @param {Function} onRowClick     (row) => void; omit for a non-clickable table
 * @param {String}   emptyMessage   shown when `rows` is empty
 * @param {String}   fallbackState  state to display when a row has none (e.g. the
 *                                  viewing manager's own state)
 * @param {Boolean}  showDistrict   print the row's district under the name — on for
 *                                  district-manager lists, off elsewhere
 * @param {Boolean}  sortable       make the column headers sort the table
 * @param {String}   defaultSortKey column sorted on first render when `sortable`
 */
const ManagerPerformanceTable = ({
  rows = [],
  renderActions,
  onRowClick,
  emptyMessage = 'No managers found.',
  fallbackState = '',
  showDistrict = false,
  sortable = false,
  defaultSortKey = 'workPct'
}) => {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState('desc');

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedRows = useMemo(() => {
    if (!sortable) return rows;
    const isText = sortKey === 'name' || sortKey === 'state' || sortKey === 'industry';
    return [...rows].sort((a, b) => {
      if (isText) {
        const av = String(a[sortKey] || '');
        const bv = String(b[sortKey] || '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const av = a[sortKey] || 0;
      const bv = b[sortKey] || 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [rows, sortable, sortKey, sortDir]);

  return (
    <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-[12px] uppercase tracking-wider font-bold text-text-muted">
          <thead>
            <tr className="bg-surface2/50 border-b border-border">
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-3 ${col.align === 'center' ? 'text-center' : ''} ${sortable ? 'cursor-pointer select-none hover:text-text-primary transition-colors' : ''}`}
                  onClick={sortable ? () => toggleSort(col.key) : undefined}
                >
                  {sortable
                    ? <span className="inline-flex items-center gap-1">{col.label}<SortIcon active={sortKey === col.key} dir={sortDir} /></span>
                    : col.label}
                </th>
              ))}
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border normal-case font-medium text-text-primary">
            {sortedRows.map((m) => {
              const state = m.state || fallbackState;
              return (
                <tr
                  key={m._id}
                  className={`hover:bg-surface2/30 transition-colors group ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={onRowClick ? () => onRowClick(m) : undefined}
                >
                  <td className="px-3 py-3 font-bold text-[13px] group-hover:text-blue transition-colors">
                    {m.name}
                    {showDistrict && m.district && (
                      <span className="block text-[12px] font-medium text-text-muted normal-case mt-0.5">{m.district}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {state && <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold">{state}</span>}
                  </td>
                  <td className="px-3 py-3 text-[14px] text-text-secondary">{m.industry || '—'}</td>
                  <td className="px-3 py-3"><WorkPctCell value={m.workPct || 0} /></td>
                  <td className="px-3 py-3 text-center text-[12px] font-mono">{m.periodLeads || 0}</td>
                  <td className="px-3 py-3 text-center text-[12px] font-mono">{m.directMeetings || 0}</td>
                  <td className="px-3 py-3 text-center text-[12px] font-mono">{m.virtualMeetings || 0}</td>
                  <td className="px-3 py-3 text-center text-[12px] font-mono">{m.blocking || 0}</td>
                  <td className="px-3 py-3 text-center text-[12px] font-mono font-bold text-blue">
                    {formatRevenue(m.revenue)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {renderActions ? renderActions(m) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedRows.length === 0 && (
              <tr><td colSpan={COLUMNS.length + 1} className="p-12 text-center text-text-muted italic normal-case">{emptyMessage}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManagerPerformanceTable;
