import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';

const IndustryManagers = () => {
  const [viewType, setViewType] = useState('daily');
  const [filterState, setFilterState] = useState('All');
  const [filterIndustry, setFilterIndustry] = useState('All');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder'],
    queryFn: () => dashboardApi.getFounderDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: managers, isLoading } = useQuery({
    queryKey: ['users', 'industry-managers-global'],
    queryFn: () => usersApi.getUsers({ role: 'industry_manager' }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const openModal = (id) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail: id }));
  };

  if (isLoading) return <DashboardSkeleton />;

  const stats = dashData?.stats || {};
  const filteredManagers = managers?.filter(m => {
    const matchesState = filterState === 'All' || m.state === filterState;
    const matchesIndustry = filterIndustry === 'All' || m.industry === filterIndustry;
    return matchesState && matchesIndustry;
  });

  const columns = [
    {
      header: 'Manager',
      accessor: 'name',
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={val} size="sm" />
          <span className="font-bold text-[14px]">{val}</span>
        </div>
      )
    },
    {
      header: 'State / Industry',
      accessor: 'state',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <Tag variant="blue" label={val} />
          <span className="text-[11px] text-text-muted font-medium">{row.industry}</span>
        </div>
      )
    },
    {
      header: 'Work %',
      accessor: 'completionPct',
      render: (val) => (
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-16 bg-surface2 rounded-full overflow-hidden border border-border">
            <div className={`h-full transition-all ${val >= 80 ? 'bg-accent' : val >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${val || 0}%` }}></div>
          </div>
          <span className="text-[11px] mono font-bold">{val || 0}%</span>
        </div>
      )
    },
    { header: 'Calls', accessor: 'callsToday', render: (val) => <span className="mono text-[11px] font-bold text-blue">{val || 0}</span>, align: 'right' },
    { header: 'Meetings', accessor: 'meetingsTotal', render: (val) => <span className="mono text-[11px] font-bold text-teal">{val || 0}</span>, align: 'right' },
    { 
      header: 'Revenue', 
      accessor: 'revenue', 
      render: (val) => <span className="mono text-[11px] font-bold text-accent">₹{val?.toLocaleString() || '0'}</span>, 
      align: 'right' 
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (id) => (
        <div className="flex gap-2">
          <Button size="xs" variant="outline" onClick={() => openModal('create-exec')}>View</Button>
          <Button size="xs" variant="outline" className="text-amber border-amber/20" onClick={() => openModal('leave-approval')}>Leave</Button>
        </div>
      ),
      align: 'right'
    }
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4 text-[11px] font-bold uppercase tracking-widest text-text-muted">
        <span className="hover:text-text-primary cursor-pointer transition-colors" onClick={() => {}}>Founder</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary">Industry State Managers</span>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-[20px] font-bold text-text-primary">Industry State Managers</div>
          <div className="text-[12px] text-text-muted mt-1">Summary across all states & industries · Staff by staff performance</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-white border-border" onClick={() => openModal('create-lead')}>Create Lead</Button>
          <Button variant="outline" size="sm" className="bg-white border-border" onClick={() => openModal('bulk-upload')}>Bulk Upload</Button>
          <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-semibold" onClick={() => openModal('create-industry-manager')}>+ Industry Manager</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="stat-card border-t-4 border-[#3b82f6]">
          <div className="stat-label text-text-muted font-bold text-[11px] uppercase tracking-wider mb-2">Total Industry Managers</div>
          <div className="text-[32px] font-bold font-mono text-text-primary mb-1">{dashData?.industryManagersPerformance?.length || 0}</div>
          <div className="text-[12px] text-text-muted font-medium">Across {new Set(dashData?.industryManagersPerformance?.map(m => m.state)).size || 0} states</div>
        </div>
        <div className="stat-card border-t-4 border-[#16a34a]">
          <div className="stat-label text-text-muted font-bold text-[11px] uppercase tracking-wider mb-2">Active Leads</div>
          <div className="text-[32px] font-bold font-mono text-text-primary mb-1">{stats.totalLeads || 0}</div>
          <div className="text-[12px] text-[#16a34a] font-medium flex items-center gap-1">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
             {stats.leadsToday || 0} this week
          </div>
        </div>
        <div className="stat-card border-t-4 border-[#ea580c]">
          <div className="stat-label text-text-muted font-bold text-[11px] uppercase tracking-wider mb-2">Conversions (Month)</div>
          <div className="text-[32px] font-bold font-mono text-text-primary mb-1">{stats.convertedThisMonth || 0}</div>
          <div className="text-[12px] text-[#16a34a] font-medium flex items-center gap-1">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
             11% vs last
          </div>
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

      <div className="flex justify-between items-end mb-4">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Staff-by-Staff Performance</div>
          <div className="text-[12px] text-text-muted mt-0.5">Daily, Weekly, Monthly work %, Calls, Meetings, Follow-ups, Revenue, Total Leaves</div>
        </div>
        <div className="flex bg-surface2 p-1 rounded-xl border border-border">
          {['Daily', 'Weekly', 'Monthly'].map(t => (
            <button 
              key={t}
              onClick={() => setViewType(t.toLowerCase())}
              className={`px-6 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${viewType === t.toLowerCase() ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] uppercase tracking-wider font-bold text-text-muted">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="p-4">Manager</th>
                <th className="p-4 text-center">State</th>
                <th className="p-4">Industry</th>
                <th className="p-4 text-center">Work %</th>
                <th className="p-4 text-center">Calls</th>
                <th className="p-4 text-center">Meetings</th>
                <th className="p-4 text-center">Follow-ups</th>
                <th className="p-4 text-center">Revenue</th>
                <th className="p-4 text-center">Leaves</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border normal-case font-medium text-text-primary">
              {dashData?.industryManagersPerformance?.map((m, idx) => (
                <tr key={m._id} className="hover:bg-surface2/30 transition-colors">
                  <td className="p-4 font-bold text-[13px]">{m.name}</td>
                  <td className="p-4 text-center">
                    <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold">{m.state}</span>
                  </td>
                  <td className="p-4 text-[12px] text-text-secondary">{m.industry}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 justify-center">
                       <div className="w-8 h-1.5 bg-surface2 rounded-full overflow-hidden">
                         <div className={`h-full ${m.workPct >= 80 ? 'bg-[#0f766e]' : m.workPct >= 60 ? 'bg-[#ea580c]' : 'bg-[#dc2626]'}`} style={{ width: `${m.workPct}%` }}></div>
                       </div>
                       <span className="font-bold text-[12px]">{m.workPct}%</span>
                    </div>
                  </td>
                  <td className="p-4 text-center text-[12px] font-mono">{m.calls}</td>
                  <td className="p-4 text-center text-[12px] font-mono">{m.meetings}</td>
                  <td className="p-4 text-center text-[12px] font-mono">{m.followups}</td>
                  <td className="p-4 text-center text-[12px] font-mono font-bold text-blue">
                     ₹{m.revenue >= 100000 ? (m.revenue / 100000).toFixed(1) + 'L' : m.revenue.toLocaleString()}
                  </td>
                  <td className="p-4 text-center text-[12px] font-mono">{m.leaves}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="xs" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-bold px-3">View</Button>
                      <Button size="xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary px-3 font-bold">Edit</Button>
                      <Button size="xs" variant="outline" className="bg-amber/5 border-amber/20 text-amber shadow-sm hover:bg-amber/10 px-3 font-bold" onClick={() => openModal('leave-approval')}>Leave</Button>
                      <Button size="xs" variant="outline" className="bg-red/5 border-red/20 text-red shadow-sm hover:bg-red/10 px-3 font-bold">Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!dashData?.industryManagersPerformance || dashData.industryManagersPerformance.length === 0) && (
                 <tr><td colSpan="10" className="p-12 text-center text-text-muted italic normal-case">No industry manager performance data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-[15px] font-bold text-text-primary">New Executive Account Creation</div>
          <div className="text-[12px] text-text-muted mt-0.5">Create executive accounts under an Industry State Manager</div>
        </div>
        <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-semibold" onClick={() => openModal('create-exec')}>+ Create Executive</Button>
      </div>

      <div className="card overflow-hidden border border-border bg-white rounded-xl shadow-sm mb-8">
        <div className="card-header border-b border-border bg-white flex justify-between items-center px-5 py-4">
          <div>
            <div className="text-[15px] font-bold text-text-primary">Staff Documents</div>
            <div className="text-[11px] text-text-muted mt-0.5">Documents: Aadhaar, PAN, Agreement, Photo, Training certificates</div>
          </div>
          <Button variant="outline" size="sm" className="bg-white text-blue border-blue/20 font-bold text-[10px] uppercase tracking-wider px-4">Attach & View</Button>
        </div>
        <div className="p-4">
          <div className="bg-blue/5 border border-blue/10 p-4 rounded-xl flex items-center gap-3 mb-6">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            <div className="text-[12px] text-blue font-medium">Select a staff member below to view or attach their documents (ID proof, agreement, bank docs, photos, training certificates).</div>
          </div>
          <div className="divide-y divide-border">
            {dashData?.industryManagersPerformance?.map((m, idx) => (
              <div key={m._id} className="flex items-center justify-between py-4 group">
                <div className="flex items-center gap-4">
                   <div className="w-8 h-8 rounded-full bg-surface2 text-text-primary flex items-center justify-center font-bold text-[11px] uppercase">{m.name.split(' ').map(n=>n[0]).join('').substring(0, 2)}</div>
                   <div>
                     <div className="text-[13px] font-bold text-text-primary group-hover:text-blue transition-colors">{m.name} — {m.industry}, {m.state}</div>
                   </div>
                </div>
                <div className="flex gap-2">
                   <Button size="xs" variant="outline" className="bg-white border-border text-text-primary font-bold text-[10px] px-4">View Docs</Button>
                   <Button size="xs" className="bg-[#0f766e] text-white border-none font-bold text-[10px] px-4">Attach</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndustryManagers;
