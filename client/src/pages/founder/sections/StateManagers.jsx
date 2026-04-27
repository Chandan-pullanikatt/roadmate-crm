import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const StateManagers = () => {
  const queryClient = useQueryClient();
  const [detailMgr, setDetailMgr] = useState(null);
  const [filterState, setFilterState] = useState('All');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder'],
    queryFn: () => dashboardApi.getFounderDashboard().then(res => res.data)
  });

  const { data: managers, isLoading } = useQuery({
    queryKey: ['users', 'state-managers'],
    queryFn: () => usersApi.getUsers({ role: 'state_manager' }).then(res => res.data)
  });

  useEffect(() => {
    const handleRefreshUsers = () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'state-managers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'founder'] });
    };

    window.addEventListener('refresh-users', handleRefreshUsers);
    return () => window.removeEventListener('refresh-users', handleRefreshUsers);
  }, [queryClient]);

  const openModal = (id) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail: id }));
  };

  if (isLoading) return <div className="p-8 text-center text-text-muted">Loading global management data...</div>;

  const stats = dashData?.stats || {};
  const filteredManagers = managers?.filter(m => filterState === 'All' || m.state === filterState);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">
        <span className="hover:text-text-primary cursor-pointer transition-colors" onClick={() => setDetailMgr(null)}>Founder</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary">State Managers</span>
      </div>

      {!detailMgr ? (
        <>
          <div className="flex justify-between items-end mb-6">
            <div>
              <div className="text-[20px] font-bold text-text-primary">All State Managers</div>
              <div className="text-[12px] text-text-muted mt-1">Summary of each state manager's dashboard · Click row to drill in</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-white border-border" onClick={() => openModal('create-lead')}>Create Lead</Button>
              <Button variant="outline" size="sm" className="bg-white border-border" onClick={() => openModal('bulk-upload')}>Bulk Upload</Button>
              <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-semibold" onClick={() => openModal('create-state-manager')}>+ State Manager</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="stat-card border-t-4 border-[#3b82f6]">
              <div className="stat-label text-text-muted font-bold text-[11px] uppercase tracking-wider mb-2">Total Leads (All States)</div>
              <div className="text-[32px] font-bold font-mono text-text-primary mb-1">{stats.totalLeads || 0}</div>
              <div className="text-[12px] text-[#16a34a] font-medium flex items-center gap-1">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                 {stats.leadsToday || 0} this week
              </div>
            </div>
            <div className="stat-card border-t-4 border-[#16a34a]">
              <div className="stat-label text-text-muted font-bold text-[11px] uppercase tracking-wider mb-2">Total Conversions</div>
              <div className="text-[32px] font-bold font-mono text-text-primary mb-1">{stats.converted || 0}</div>
              <div className="text-[12px] text-[#16a34a] font-medium flex items-center gap-1">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                 {stats.convertedThisMonth || 0} this month
              </div>
            </div>
            <div className="stat-card border-t-4 border-[#ea580c]">
              <div className="stat-label text-text-muted font-bold text-[11px] uppercase tracking-wider mb-2">Avg Work %</div>
              <div className="text-[32px] font-bold font-mono text-text-primary mb-1">
                {Math.round(dashData?.byState?.length ? dashData.byState.reduce((acc, curr) => acc + (curr.avgWorkPct || 0), 0) / dashData.byState.length : 0)}%
              </div>
              <div className="text-[12px] text-text-muted font-medium">Across all managers</div>
            </div>
            <div className="stat-card border-t-4 border-[#dc2626]">
              <div className="stat-label text-text-muted font-bold text-[11px] uppercase tracking-wider mb-2">Leave Requests</div>
              <div className="text-[32px] font-bold font-mono text-text-primary mb-1">{stats.pendingLeavesCount || 0}</div>
              <div className="text-[12px] text-[#ea580c] font-medium flex items-center gap-1">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                 Pending approval
              </div>
            </div>
          </div>

          <div className="card overflow-hidden border border-border bg-white rounded-xl shadow-sm">
            <div className="card-header border-b border-border bg-white flex justify-between items-center px-5 py-4">
              <div className="text-[15px] font-bold text-text-primary">State Manager Profiles</div>
              <div className="flex gap-2">
                <Button variant="outline" size="xs" className="bg-white text-text-primary font-bold text-[10px] uppercase tracking-wider px-4">Export</Button>
                <select 
                  className="bg-white border border-border rounded-lg px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider outline-none focus:border-blue transition-colors min-w-[140px]"
                  value={filterState}
                  onChange={e => setFilterState(e.target.value)}
                >
                  <option value="All">All States</option>
                  {dashData?.byState?.map(s => <option key={s.state} value={s.state}>{s.state}</option>)}
                </select>
              </div>
            </div>
            <div className="divide-y divide-border">
              {dashData?.byState?.filter(s => filterState === 'All' || s.state === filterState).map((m, idx) => {
                const initials = m.stateManager !== 'Unassigned' ? m.stateManager.split(' ').map(n=>n[0]).join('').substring(0, 2).toUpperCase() : 'U';
                const colors = ['bg-[#3b82f6]', 'bg-[#4f46e5]', 'bg-[#0f766e]', 'bg-[#ea580c]'];
                const avatarColor = colors[idx % colors.length];

                return (
                  <div key={m.stateManagerId || idx} className="flex items-center justify-between p-5 hover:bg-surface2/30 transition-colors group cursor-pointer" onClick={() => setDetailMgr(m)}>
                    <div className="flex items-center gap-4 min-w-[340px]">
                      <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm ${avatarColor}`}>
                        {initials}
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-text-primary group-hover:text-blue transition-colors">{m.stateManager}</div>
                        <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                          {m.state} · {m.calls || 0} calls · {m.meetings || 0} meetings
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-10 flex-1">
                      <div className="text-center w-14">
                        <div className="text-[15px] font-bold text-blue font-mono">{m.leads || 0}</div>
                        <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Leads</div>
                      </div>
                      <div className="text-center w-14">
                        <div className="text-[15px] font-bold text-[#16a34a] font-mono">{m.converted || 0}</div>
                        <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Converted</div>
                      </div>
                      <div className="text-center w-24">
                        <div className="text-[15px] font-bold text-teal font-mono">
                          ₹{m.revenue >= 100000 ? (m.revenue >= 10000000 ? (m.revenue / 10000000).toFixed(1) + 'Cr' : (m.revenue / 100000).toFixed(1) + 'L') : m.revenue.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Revenue</div>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center w-24 border-l border-border pl-4">
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-1.5 bg-surface2 rounded-full overflow-hidden">
                             <div className="h-full bg-[#16a34a]" style={{ width: `${m.avgWorkPct || 0}%` }}></div>
                           </div>
                           <div className="text-[13px] font-bold text-text-primary">{Math.round(m.avgWorkPct || 0)}%</div>
                        </div>
                        <div className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5 font-bold">Work %</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 ml-10 w-[240px]">
                      <Button size="xs" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm px-4 font-bold" onClick={(e) => { e.stopPropagation(); setDetailMgr(m); }}>View</Button>
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary px-3 font-bold" onClick={(e) => e.stopPropagation()}>Edit</Button>
                      <Button size="xs" variant="outline" className="bg-amber/5 border-amber/20 text-amber shadow-sm hover:bg-amber/10 px-3 font-bold" onClick={(e) => { e.stopPropagation(); openModal('leave-approval'); }}>Leave</Button>
                      <Button size="xs" variant="outline" className="bg-red/5 border-red/20 text-red shadow-sm hover:bg-red/10 px-3 font-bold" onClick={(e) => e.stopPropagation()}>Delete</Button>
                    </div>
                  </div>
                );
              })}
              {dashData?.byState?.length === 0 && <div className="p-12 text-center text-text-muted italic">No state managers found</div>}
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
