import React, { useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';

import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';

const DistrictExecutives = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewType, setViewType] = useState('monthly');
  const [filterState, setFilterState] = useState('All');


  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'founder', viewType],
    queryFn: () => dashboardApi.getFounderDashboard({ period: viewType }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  React.useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'founder'] });
    };
    window.addEventListener('refresh-users', handleRefresh);
    return () => window.removeEventListener('refresh-users', handleRefresh);
  }, [queryClient]);

  const openModal = (id) => {
    window.dispatchEvent(new CustomEvent('open-modal', { detail: id }));
  };

  const handleDelete = async (m) => {
    const warning = m.leads > 0 ? `\n\nWarning: This executive has ${m.leads} assigned leads that will become unallocated.` : '';
    if (window.confirm(`Are you sure you want to delete ${m.name}?${warning}`)) {
      try {
        const { usersApi } = await import('../../../api/usersApi');
        await usersApi.deleteUser(m._id);
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'founder'] });
      } catch (err) {
        alert(err.response?.data?.message || 'Error deleting executive');
      }
    }
  };


  if (isLoading) return <DashboardSkeleton />;

  const stats = dashData?.stats || {};
  const executives = dashData?.executivesPerformance || [];
  const filteredExecs = executives.filter(e => filterState === 'All' || e.state === filterState);

  return (
    <div className="animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-[12px] font-medium text-text-muted">
        <span>Founder</span>
        <span className="text-text-muted/30">›</span>
        <span className="text-text-primary font-semibold">District Executives</span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight">District Executives</h1>
          <p className="text-[14px] text-text-muted mt-0.5">Performance summary · Lead handling · Attendance · Salary</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white border-border shadow-sm font-semibold text-[13px]"
            onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', role: 'executive' } }))}
          >
            + Create Executive
          </Button>
          <select 
            className="bg-white border border-border rounded-lg px-4 py-1.5 text-[13px] font-medium outline-none focus:border-blue transition-colors min-w-[140px] shadow-sm appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
            value={filterState}
            onChange={e => setFilterState(e.target.value)}
          >
            <option value="All">All States</option>
            {Array.from(new Set(executives.map(e => e.state))).filter(Boolean).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl border border-border shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#ea580c]"></div>
          <div className="text-text-muted font-bold text-[11px] uppercase tracking-wider mb-3">Total Executives</div>
          <div className="text-[36px] font-bold text-text-primary leading-tight mb-2">{stats.salesStaff?.total || 0}</div>
          <div className="text-[12px] text-[#16a34a] font-bold flex items-center gap-1.5">
             <span className="text-[14px]">↑</span> {stats.executivesThisMonth || 0} this month
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-border shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#0f766e]"></div>
          <div className="text-text-muted font-bold text-[11px] uppercase tracking-wider mb-3">Total Handling Leads</div>
          <div className="text-[36px] font-bold text-text-primary leading-tight mb-2">{stats.totalLeads?.toLocaleString() || 0}</div>
          <div className="text-[12px] text-[#0f766e] font-bold">Active pipeline</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-border shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#3b82f6]"></div>
          <div className="text-text-muted font-bold text-[11px] uppercase tracking-wider mb-3">Total Connected</div>
          <div className="text-[36px] font-bold text-text-primary leading-tight mb-2">{stats.totalCalls?.toLocaleString() || 0}</div>
          <div className="text-[12px] text-text-muted font-bold">
            <span className="text-[#3b82f6]">{stats.reachRate || 0}%</span> reach rate
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-border shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#ea580c]"></div>
          <div className="text-text-muted font-bold text-[11px] uppercase tracking-wider mb-3">Conversions</div>
          <div className="text-[36px] font-bold text-text-primary leading-tight mb-2">{stats.totalConversions?.toLocaleString() || 0}</div>
          <div className="text-[12px] text-text-muted font-bold">
            <span className="text-[#16a34a]">{stats.conversionRate || 0}%</span> conv. rate
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-bold text-text-primary">Executive Performance — {viewType.charAt(0).toUpperCase() + viewType.slice(1)} Report</h2>
          <p className="text-[13px] text-text-muted mt-1 font-medium">Handling leads · Connected · Follow-ups · Converted · Revenue · Leaves</p>
        </div>
        <div className="flex bg-[#f1f5f9] p-1 rounded-xl border border-border w-fit">
          {['Daily', 'Weekly', 'Monthly'].map(t => (
            <button 
              key={t}
              onClick={() => setViewType(t.toLowerCase())}
              className={`px-5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${viewType === t.toLowerCase() ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden border border-border bg-white rounded-xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] uppercase tracking-wider font-bold text-text-muted">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-border">
                <th className="p-4 pl-6">Executive</th>
                <th className="p-4">State - Industry</th>
                <th className="p-4 text-center">Handling</th>
                <th className="p-4 text-center">Connected</th>
                <th className="p-4 text-center">Follow-up</th>
                <th className="p-4 text-center">Converted</th>
                <th className="p-4 text-center">Revenue</th>
                <th className="p-4 text-center">Work %</th>
                <th className="p-4 text-center">Leaves</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border normal-case font-medium text-text-primary">
              {filteredExecs.map((m) => (
                <tr key={m._id} className="hover:bg-surface2/30 transition-colors group">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} size="sm" className="rounded-lg shadow-sm border border-border" />
                      <span className="font-bold text-[14px] text-text-primary group-hover:text-blue transition-colors">{m.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue/10 text-blue px-2 py-0.5 rounded text-[10px] font-bold uppercase">{m.state || 'N/A'}</span>
                      <span className="text-[12px] text-text-muted font-medium capitalize">{m.industry || 'General'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center text-[13px] font-semibold text-text-secondary">{m.leads || 0}</td>
                  <td className="p-4 text-center text-[13px] font-semibold text-text-secondary">{m.calls || 0}</td>
                  <td className="p-4 text-center text-[13px] font-semibold text-text-secondary">{m.followups || 0}</td>
                  <td className="p-4 text-center text-[13px] font-semibold text-text-secondary">{m.converted || 0}</td>
                  <td className="p-4 text-center text-[13px] font-bold text-blue">
                     ₹{m.revenue >= 100000 ? (m.revenue / 100000).toFixed(1) + 'L' : (m.revenue / 1000).toFixed(1) + 'K'}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3 justify-center">
                       <div className="w-16 h-2 bg-[#f1f5f9] rounded-full overflow-hidden border border-border/50">
                         <div className={`h-full transition-all duration-700 ${m.workPct >= 80 ? 'bg-[#0f766e]' : m.workPct >= 60 ? 'bg-[#ea580c]' : 'bg-[#dc2626]'}`} style={{ width: `${m.workPct}%` }}></div>
                       </div>
                       <span className="font-bold text-[12px] w-8">{m.workPct}%</span>
                    </div>
                  </td>
                  <td className="p-4 text-center text-[13px] font-semibold text-text-secondary">{m.leaves || 0}</td>
                  <td className="p-4 text-right pr-6">
                    <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Button 
                        size="xs" 
                        className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-bold px-3 py-1"
                        onClick={() => navigate(`/dashboard/executives/${m._id}`)}
                      >
                        View
                      </Button>
                      <Button 
                        size="xs" 
                        variant="outline" 
                        className="bg-white border-border shadow-sm text-text-primary px-3 py-1 font-bold"
                        onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', editData: m } }))}
                      >
                        Edit
                      </Button>
                      <Button 
                        size="xs" 
                        variant="outline" 
                        className="bg-white border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] shadow-sm px-3 py-1 font-bold"
                        onClick={() => handleDelete(m)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>

                </tr>
              ))}
              {filteredExecs.length === 0 && (
                 <tr>
                   <td colSpan="10" className="p-16 text-center">
                     <div className="flex flex-col items-center gap-2">
                       <div className="text-[24px]">📊</div>
                       <p className="text-text-muted italic font-medium">No executive performance data available for this selection.</p>
                     </div>
                   </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DistrictExecutives;
