import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';
import { usePeriod, PeriodPicker } from '../../../components/LeadPipelinePanel';
import { ActiveFilter, ActiveToggleButton, matchesActiveFilter } from '../../../components/ActiveStatusControls';

const EMPTY_PERF = { workPct: 0, calls: 0, directMeetings: 0, virtualMeetings: 0, followups: 0, revenue: 0 };

const IndustryManagers = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const picker = usePeriod('today');
  const { period, value: periodValue } = picker;
  const [filterState, setFilterState] = useState('All');
  const [showInactive, setShowInactive] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'founder', period, periodValue],
    queryFn: () => dashboardApi.getFounderDashboard({ period, value: periodValue || undefined }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const { data: managers, isLoading } = useQuery({
    queryKey: ['users', 'industry-managers-global'],
    queryFn: () => usersApi.getUsers({ role: 'industry_manager' }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', {
      detail: typeof type === 'string' ? { type, ...data } : type
    }));
  };

  useEffect(() => {
    const handleRefreshUsers = () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'industry-managers-global'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'founder'] });
    };
    window.addEventListener('refresh-users', handleRefreshUsers);
    return () => window.removeEventListener('refresh-users', handleRefreshUsers);
  }, [queryClient]);

  const handleDelete = async (m) => {
    if (window.confirm(`Are you sure you want to delete ${m.name}? This action cannot be undone.`)) {
      try {
        await usersApi.deleteUser(m._id);
        queryClient.invalidateQueries({ queryKey: ['users', 'industry-managers-global'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'founder'] });
      } catch (err) {
        alert(err.response?.data?.message || 'Error deleting manager');
      }
    }
  };

  if (isLoading) return <DashboardSkeleton />;

  const filteredManagers = managers?.filter(m => {
    const matchesState = filterState === 'All' || m.state === filterState;
    const matchesIndustry = filterIndustry === 'All' || m.industry === filterIndustry;
    return matchesState && matchesIndustry;
  });

  // Who is listed comes from the user list; the period filter only changes the numbers.
  const perfById = new Map((dashData?.industryManagersPerformance || []).map(p => [String(p._id), p]));
  const performanceRows = (filteredManagers || [])
    .filter(u => matchesActiveFilter(u, showInactive))
    .map(u => ({ ...EMPTY_PERF, ...perfById.get(String(u._id)), _id: u._id, name: u.name, state: u.state, industry: u.industry, user: u }));

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
          <span className="text-[13px] text-text-muted font-medium">{row.industry}</span>
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
      <div className="flex items-center gap-2 mb-4 text-[13px] font-bold uppercase tracking-widest text-text-muted">
        <span className="hover:text-text-primary cursor-pointer transition-colors" onClick={() => {}}>Founder</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary">Industry State Managers</span>
      </div>

      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="text-[20px] font-bold text-text-primary">Industry State Managers</div>
          <div className="text-[14px] text-text-muted mt-1">Summary across all states & industries · Staff by staff performance</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-semibold" onClick={() => openModal('create-industry-manager')}>+ Industry Manager</Button>
        </div>
      </div>

      <div className="flex justify-between items-end mb-4">
        <div>
          <div className="text-[15px] font-bold text-text-primary">Staff-by-Staff Performance</div>
          <div className="text-[14px] text-text-muted mt-0.5">Work %, Calls, Direct & Virtual Meetings, Follow-ups and Revenue for the selected period</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActiveFilter showInactive={showInactive} onChange={setShowInactive} />
          <PeriodPicker {...picker} />
        </div>
      </div>

      <div className="card overflow-hidden mb-8 border border-border bg-white rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px] uppercase tracking-wider font-bold text-text-muted">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="px-3 py-3">Manager</th>
                <th className="px-3 py-3 text-center">State</th>
                <th className="px-3 py-3">Industry</th>
                <th className="px-3 py-3 text-center">Work %</th>
                <th className="px-3 py-3 text-center">Calls</th>
                <th className="px-3 py-3 text-center">Direct<br />Meetings</th>
                <th className="px-3 py-3 text-center">Virtual<br />Meetings</th>
                <th className="px-3 py-3 text-center">Follow-ups</th>
                <th className="px-3 py-3 text-center">Revenue</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border normal-case font-medium text-text-primary">
              {performanceRows.map((m, idx) => (
                <tr
                  key={m._id}
                  className="hover:bg-surface2/30 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/dashboard/executives/${m._id}`)}
                >
                  <td className="px-3 py-3 font-bold text-[13px] group-hover:text-blue transition-colors">{m.name}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold">{m.state}</span>
                  </td>
                  <td className="px-3 py-3 text-[14px] text-text-secondary">{m.industry}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 justify-center">
                       <div className="w-8 h-1.5 bg-surface2 rounded-full overflow-hidden">
                         <div className={`h-full ${m.workPct >= 80 ? 'bg-[#0f766e]' : m.workPct >= 60 ? 'bg-[#ea580c]' : 'bg-[#dc2626]'}`} style={{ width: `${m.workPct}%` }}></div>
                       </div>
                       <span className="font-bold text-[12px]">{m.workPct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center text-[12px] font-mono">{m.calls}</td>
                  <td className="px-3 py-3 text-center text-[12px] font-mono">{m.directMeetings}</td>
                  <td className="px-3 py-3 text-center text-[12px] font-mono">{m.virtualMeetings}</td>
                  <td className="px-3 py-3 text-center text-[12px] font-mono">{m.followups}</td>
                  <td className="px-3 py-3 text-center text-[12px] font-mono font-bold text-blue">
                     ₹{m.revenue >= 100000 ? (m.revenue / 100000).toFixed(1) + 'L' : m.revenue.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button size="2xs" variant="outline" className="bg-white border-border shadow-sm text-text-primary font-bold" onClick={() => {
                        const userObj = filteredManagers?.find(u => u._id === m._id);
                        if (userObj) openModal('create-exec', { editData: userObj });
                      }}>Edit</Button>
                      <ActiveToggleButton user={m.user} compact />
                      <Button size="2xs" variant="outline" className="bg-red/5 border-red/20 text-red shadow-sm hover:bg-red/10 font-bold" onClick={() => handleDelete(m)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {performanceRows.length === 0 && (
                 <tr><td colSpan="10" className="p-12 text-center text-text-muted italic normal-case">{showInactive ? 'No inactive industry managers.' : 'No industry manager performance data available.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden border border-border bg-white rounded-xl shadow-sm mb-8">
        <div className="card-header border-b border-border bg-white flex justify-between items-center px-5 py-4">
          <div>
            <div className="text-[15px] font-bold text-text-primary">Staff Documents</div>
            <div className="text-[13px] text-text-muted mt-0.5">Documents: Aadhaar, PAN, Agreement, Photo, Training certificates</div>
          </div>
          <Button variant="outline" size="sm" className="bg-white text-blue border-blue/20 font-bold text-[10px] uppercase tracking-wider px-4">Attach & View</Button>
        </div>
        <div className="p-4">
          <div className="bg-blue/5 border border-blue/10 p-4 rounded-xl flex items-center gap-3 mb-6">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            <div className="text-[12px] text-blue font-medium">Select a staff member below to view or attach their documents (ID proof, agreement, bank docs, photos, training certificates).</div>
          </div>
          <div className="divide-y divide-border">
            {performanceRows.map((m, idx) => (
              <div key={m._id} className="flex items-center justify-between py-4 group">
                <div className="flex items-center gap-4">
                   <div className="w-8 h-8 rounded-full bg-surface2 text-text-primary flex items-center justify-center font-bold text-[11px] uppercase">{m.name.split(' ').map(n=>n[0]).join('').substring(0, 2)}</div>
                   <div>
                     <div className="text-[13px] font-bold text-text-primary group-hover:text-blue transition-colors">{m.name} — {m.industry}, {m.state}</div>
                   </div>
                </div>
                <div className="flex gap-2">
                   <Button size="xs" variant="outline" className="bg-white border-border text-text-primary font-bold text-[10px] px-4" onClick={() => {
                     const userObj = filteredManagers?.find(u => u._id === m._id);
                     if (userObj) openModal({ type: 'view-docs', user: userObj });
                   }}>View Docs</Button>
                   <Button size="xs" className="bg-[#0f766e] text-white border-none font-bold text-[10px] px-4" onClick={() => {
                     const userObj = filteredManagers?.find(u => u._id === m._id);
                     if (userObj) openModal({ type: 'view-docs', user: userObj });
                   }}>Attach</Button>
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
