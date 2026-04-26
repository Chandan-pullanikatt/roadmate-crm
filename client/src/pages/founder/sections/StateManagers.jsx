import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const StateManagers = () => {
  const [detailMgr, setDetailMgr] = useState(null);
  const [filterState, setFilterState] = useState('All');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder'],
    queryFn: () => dashboardApi.getFounderDashboard().then(res => res.data)
  });

  const { data: managers, isLoading } = useQuery({
    queryKey: ['users', 'state-managers'],
    queryFn: () => usersApi.getUsers({ role: 'state-manager' }).then(res => res.data)
  });

  const openModal = (id) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail: id }));
  };

  if (isLoading) return <div className="p-8 text-center text-text-muted">Loading global management data...</div>;

  const stats = dashData?.stats || {};
  const filteredManagers = managers?.filter(m => filterState === 'All' || m.state === filterState);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">
        <span className="hover:text-purple cursor-pointer" onClick={() => setDetailMgr(null)}>FOUNDER</span>
        <span>/</span>
        <span className={detailMgr ? 'hover:text-purple cursor-pointer' : 'text-text-primary'} onClick={() => setDetailMgr(null)}>STATE MANAGERS</span>
        {detailMgr && (
          <>
            <span>/</span>
            <span className="text-text-primary">{detailMgr.name}</span>
          </>
        )}
      </div>

      {!detailMgr ? (
        <>
          <div className="section-header">
            <div>
              <div className="section-title">All State Managers</div>
              <div className="section-sub">State head dashboards, conversion tracking & regional performance</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openModal('add-lead')}>Create Lead</Button>
              <Button className="bg-purple text-white" size="sm" onClick={() => openModal('create-state-manager')}>+ State Manager</Button>
            </div>
          </div>

          <div className="stat-grid mb-6">
            <div className="stat-card">
              <div className="stat-label">Leads (Global)</div>
              <div className="stat-value text-blue">{stats.totalLeads || 0}</div>
              <div className="stat-delta">Across all states</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Enterprise Conv.</div>
              <div className="stat-value text-accent">{stats.conversionRate || 0}%</div>
              <div className="stat-delta">Platform average</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Efficiency</div>
              <div className="stat-value text-teal">{stats.attendancePct || 0}%</div>
              <div className="stat-delta">Regional performance</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Leave Requests</div>
              <div className="stat-value text-amber">{stats.pendingLeaves || 0}</div>
              <div className="stat-delta">Pending your review</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header border-b border-border bg-surface2/10 flex justify-between items-center">
              <div className="section-title text-sm">State Manager Profiles</div>
              <select 
                className="bg-surface border border-border rounded-lg px-4 py-1.5 text-xs outline-none focus:border-purple"
                value={filterState}
                onChange={e => setFilterState(e.target.value)}
              >
                <option value="All">All States</option>
                <option value="Kerala">Kerala</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Karnataka">Karnataka</option>
              </select>
            </div>
            <div className="divide-y divide-border">
              {filteredManagers?.map(m => (
                <div key={m._id} className="flex items-center gap-4 p-5 hover:bg-surface2 transition-colors cursor-pointer" onClick={() => setDetailMgr(m)}>
                  <Avatar name={m.name} size="lg" className="av-state" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-bold">{m.name}</div>
                    <div className="text-[12px] text-text-muted mt-0.5">📍 {m.state} · SM Dashboard</div>
                  </div>
                  <div className="flex gap-8 mx-8">
                    <div className="text-center"><div className="text-[15px] font-bold text-blue mono">{m.leadsCount || 0}</div><div className="text-[9px] text-text-muted uppercase">Leads</div></div>
                    <div className="text-center"><div className="text-[15px] font-bold text-accent mono">₹{m.revenue?.toLocaleString() || '0'}</div><div className="text-[9px] text-text-muted uppercase">Revenue</div></div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="xs" variant="outline" onClick={e => {e.stopPropagation(); setDetailMgr(m)}}>View</Button>
                    <Button size="xs" variant="outline" className="text-amber border-amber/20" onClick={e => {e.stopPropagation(); openModal('leave-approval');}}>Leave</Button>
                  </div>
                </div>
              ))}
              {filteredManagers?.length === 0 && <div className="p-12 text-center text-text-muted italic">No state managers found for this filter</div>}
            </div>
          </div>
        </>
      ) : (
        <div className="animate-in slide-in-from-right-4 duration-300">
          <div className="section-header">
            <div>
              <div className="section-title">{detailMgr.name} · {detailMgr.state} Head</div>
              <div className="section-sub">Drill-down analytics for the {detailMgr.state} regional office</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDetailMgr(null)}>← Back to List</Button>
              <Button className="bg-purple text-white" size="sm">Download State Report</Button>
            </div>
          </div>

          <div className="stat-grid mb-6">
            <div className="stat-card">
              <div className="stat-label">Regional Leads</div>
              <div className="stat-value">{detailMgr.leadsCount || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Regional Revenue</div>
              <div className="stat-value text-teal">₹{detailMgr.revenue?.toLocaleString() || '0'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Team Efficiency</div>
              <div className="stat-value text-accent">{detailMgr.completionPct || 0}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Staff Count</div>
              <div className="stat-value text-blue">{detailMgr.staffCount || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
               <div className="card-header border-b border-border bg-surface2/10"><div className="section-title text-sm">Manager Profile Details</div></div>
               <div className="card-body">
                  <div className="flex flex-col gap-4">
                     <div className="flex justify-between border-b border-border pb-3">
                        <span className="text-xs text-text-muted font-bold">Full Name</span>
                        <span className="text-xs font-bold">{detailMgr.name}</span>
                     </div>
                     <div className="flex justify-between border-b border-border pb-3">
                        <span className="text-xs text-text-muted font-bold">Email</span>
                        <span className="text-xs font-bold">{detailMgr.email}</span>
                     </div>
                     <div className="flex justify-between border-b border-border pb-3">
                        <span className="text-xs text-text-muted font-bold">Joining Date</span>
                        <span className="text-xs font-bold">{new Date(detailMgr.createdAt).toLocaleDateString()}</span>
                     </div>
                  </div>
               </div>
            </div>
            <div className="card">
               <div className="card-header border-b border-border bg-surface2/10"><div className="section-title text-sm">Industry Managers in {detailMgr.state}</div></div>
               <div className="card-body p-8 text-center text-text-muted text-xs italic">
                  Deep drill-down into Industry Managers for this state is available in the Industry Managers tab.
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StateManagers;
