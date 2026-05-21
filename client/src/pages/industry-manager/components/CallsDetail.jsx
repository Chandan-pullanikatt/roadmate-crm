import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Tag, DashboardSkeleton } from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';

const outcomeVariant = (action, note) => {
  if (!action) return 'gray';
  if (action === 'called' && note?.toLowerCase().includes('rnr')) return 'amber';
  if (action === 'called') return 'blue';
  return 'gray';
};

const outcomeLabel = (action, note) => {
  if (!note) return 'Call Logged';
  const n = note.toLowerCase();
  if (n.includes('rnr') || n.includes('no answer') || n.includes('not reachable')) return 'RNR';
  if (n.includes('connect') || n.includes('spoke') || n.includes('done')) return 'Connected';
  if (n.includes('follow')) return 'Follow-up';
  if (n.includes('meeting')) return 'Meeting Set';
  return 'Logged';
};

const CallsDetail = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(r => r.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: prev => prev
  });

  const { data, isLoading } = useQuery({
    queryKey: ['activities', 'calls', page],
    queryFn: () => dashboardApi.getActivities('calls', { page, limit: 30 }).then(r => r.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: prev => prev
  });

  const userInfo = dashData?.user || {};
  const activities = data?.data || [];
  const pagination = data?.pagination || {};

  const filtered = search.trim()
    ? activities.filter(a => {
        const q = search.toLowerCase();
        return (
          (a.lead?.company || a.lead?.name || '').toLowerCase().includes(q) ||
          (a.performedBy?.name || '').toLowerCase().includes(q) ||
          (a.note || '').toLowerCase().includes(q)
        );
      })
    : activities;

  if (isLoading && !data) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Call Log</h1>
          <p className="text-sm text-text-muted">All calls · Outcomes · Feedback · {userInfo.industry} team</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search lead, executive, notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-surface2 border border-border rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-purple/20 transition-all outline-none min-w-[280px]"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
          </div>
          <Avatar name={userInfo.name} size="md" className="border-2 border-purple/10" />
        </div>
      </div>

      {/* Sub header */}
      <div className="bg-surface1 border border-border/40 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold">Call Log · {userInfo.industry} Executives</h2>
          <p className="text-xs text-text-muted">Every call made by your team — outcome, notes, lead details</p>
        </div>
        <Tag variant="blue" label={`${pagination.total || 0} Total Calls`} className="font-black px-5" />
      </div>

      {/* Table */}
      <div className="card shadow-lg shadow-purple/5 border-border/40 overflow-hidden">
        <div className="px-8 pt-6 pb-3">
          <h3 className="text-sm font-black text-text-primary uppercase tracking-tight">All Call Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-surface2/30 text-[9px] font-black text-text-muted uppercase tracking-widest border-y border-border/40">
                <th className="px-8 py-4">Lead / Company</th>
                <th className="px-6 py-4">Executive</th>
                <th className="px-6 py-4">District</th>
                <th className="px-6 py-4 text-center">Outcome</th>
                <th className="px-6 py-4">Notes / Feedback</th>
                <th className="px-6 py-4 text-right pr-8">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((a, idx) => (
                <tr key={a._id || idx} className="hover:bg-purple-light/5 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="font-bold text-xs text-text-primary group-hover:text-purple transition-colors">
                      {a.lead?.company || a.lead?.name || 'Unknown Lead'}
                    </div>
                    {a.lead?.company && a.lead?.name && (
                      <div className="text-[10px] text-text-muted">{a.lead.name}</div>
                    )}
                    {a.lead?.phone && (
                      <div className="text-[10px] text-text-muted font-mono">{a.lead.phone}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black text-white av-${idx % 5}`}>
                        {(a.performedBy?.name || 'U').charAt(0)}
                      </div>
                      <span className="text-[11px] font-bold text-text-primary">{a.performedBy?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-tight">
                      {a.performedBy?.district || a.lead?.district || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Tag
                      variant={outcomeLabel(a.action, a.note) === 'RNR' ? 'amber' : outcomeLabel(a.action, a.note) === 'Connected' ? 'green' : 'blue'}
                      label={outcomeLabel(a.action, a.note)}
                      className="text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-tighter"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[11px] text-text-secondary leading-relaxed">
                      {a.note ? (a.note.length > 80 ? a.note.slice(0, 80) + '…' : a.note) : <span className="italic text-text-muted">No notes</span>}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right pr-8">
                    <div className="text-[10px] font-bold text-text-primary">
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                    <div className="text-[9px] text-text-muted">
                      {a.createdAt ? new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center text-text-muted italic">
                    {search ? `No calls matching "${search}"` : 'No call records found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-8 py-4 border-t border-border/40 flex items-center justify-between">
            <span className="text-[11px] text-text-muted font-bold">
              Page {pagination.page} of {pagination.pages} · {pagination.total} records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-1.5 rounded-lg border border-border text-[11px] font-bold text-text-muted hover:bg-surface2 disabled:opacity-40 transition-all"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-4 py-1.5 rounded-lg border border-border text-[11px] font-bold text-text-muted hover:bg-surface2 disabled:opacity-40 transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallsDetail;
