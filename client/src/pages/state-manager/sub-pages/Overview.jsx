import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { leaveApi } from '../../../api/leaveApi';
import { Avatar, Button, Tag } from '../../../components/ui';
import { toast } from 'react-hot-toast';

const Overview = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [eventFilter, setEventFilter] = useState('Today');
  const [pipelineFilter, setPipelineFilter] = useState('This Month');
  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const leaveMutation = useMutation({
    mutationFn: ({ id, status }) => {
      if (status === 'approved') return leaveApi.approveLeave(id);
      return leaveApi.rejectLeave(id, { approvalNote: 'Rejected by State Manager' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'state-manager'] });
      toast.success('Leave request updated');
    },
    onError: (err) => toast.error(err.message)
  });

  // Sub-pages are switched via the ?page= param read by StateDashboard.jsx
  const goToPage = (page) => navigate(`/dashboard?page=${page}`);
  const goToLead = (id) => id && navigate(`/leads/${id}`);

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', { 
      detail: typeof type === 'string' ? { type, ...data } : type 
    }));
  };

  if (isLoading) return <DashboardSkeleton />;

  const stats = dashData?.stats || {};
  const managers = dashData?.industryManagers || [];
  const allEvents = dashData?.upcomingEvents || [];
  const allPipeline = dashData?.pipelineData || [];
  const expectedOnboarding = dashData?.expectedOnboarding || [];
  const leaveRequests = dashData?.leaveRequests || [];
  const escalated = dashData?.escalated || [];
  const user = dashData?.user || {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const events = allEvents.filter(e => {
    const d = new Date(e.time);
    d.setHours(0, 0, 0, 0);
    if (eventFilter === 'Today') return d.getTime() === today.getTime();
    return d.getTime() === tomorrow.getTime();
  });

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const pipeline = allPipeline.filter(p => {
    if (!p.updatedAt) return true;
    const d = new Date(p.updatedAt);
    return pipelineFilter === 'This Week' ? d >= weekStart : d >= monthStart;
  });

  const formatCurrency = (val) => {
    if (val >= 100000) return `\u20B9${(val / 100000).toFixed(1)}L`;
    return `\u20B9${val.toLocaleString()}`;
  };

  const statCard = 'bg-surface1 p-5 rounded-2xl border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group relative overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50';

  // Makes a stat card behave like a button (pointer + keyboard) without changing its markup
  const cardProps = (page) => ({
    role: 'button',
    tabIndex: 0,
    className: statCard,
    onClick: () => goToPage(page),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToPage(page); }
    },
  });

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">State Manager Dashboard</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            {user.state} · Full state overview · Industry managers & executives
          </p>
        </div>
      </div>

      {/* Escalation Alert */}
      {escalated.length > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-2xl p-4 flex items-center gap-4 mb-6 animate-pulse-subtle shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center text-[#D97706] text-lg shrink-0">{"\u26A0"}</div>
          <div className="flex-1">
            <div className="text-[13.5px] font-bold text-[#92400E]">
              {escalated.length} Escalated Lead{escalated.length > 1 ? 's' : ''} <span className="font-normal">from Industry Manager {"\u2014"} <button onClick={() => goToLead(escalated[0]._id)} className="font-bold underline underline-offset-2 hover:text-[#B45309]">{escalated[0].company || escalated[0].name}</button> {"\u00B7"} {escalated[0].district} {"\u00B7"} {escalated[0].priority}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="bg-[#D97706] hover:bg-[#B45309] text-white border-none h-8 px-4 text-[12px] font-bold"
              onClick={() => openModal('escalate-lead', { leadData: escalated[0] })}
            >
              Escalate to Founder
            </Button>
          </div>
        </div>
      )}

      {/* Stat Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <div {...cardProps('industry-managers')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-blue/40"></div>
          <div className="text-[13px] font-bold text-text-muted">Industry Managers</div>
          <div className="text-[28px] font-black text-text-primary mt-1">{stats.industryManagersCount}</div>
          <div className="text-[11.5px] font-bold text-green mt-2 flex items-center gap-1">
             {stats.newManagersThisMonth > 0 ? `\u2191 ${stats.newManagersThisMonth} added this month` : '\u2191 All active'}
          </div>
        </div>

        <div {...cardProps('reports')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-teal/40"></div>
          <div className="text-[13px] font-bold text-text-muted">Total Revenue · {user.state}</div>
          <div className="text-[28px] font-black text-teal mt-1">{formatCurrency(stats.totalRevenue)}</div>
          <div className="text-[11.5px] font-bold text-green mt-2 flex items-center gap-1">
             {(stats.revGrowth ?? 0) >= 0 ? '\u2191' : '\u2193'} {Math.abs(stats.revGrowth ?? 0)}% vs last month
          </div>
        </div>

        <div {...cardProps('leads')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-amber/40"></div>
          <div className="text-[13px] font-bold text-text-muted">Active Leads</div>
          <div className="text-[28px] font-black text-[#D97706] mt-1">{stats.activeLeads}</div>
          <div className="text-[11.5px] font-bold text-text-muted mt-2 flex items-center gap-1">
             \u2192 {stats.followupsToday ?? 0} follow-ups today
          </div>
        </div>

        <div {...cardProps('leads')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-green/40"></div>
          <div className="text-[13px] font-bold text-text-muted">Converted This Month</div>
          <div className="text-[28px] font-black text-green mt-1">{stats.convertedThisMonth}</div>
          <div className="text-[11.5px] font-bold text-green mt-2 flex items-center gap-1">
             {(stats.convGrowth ?? 0) >= 0 ? '\u2191' : '\u2193'} {Math.abs(stats.convGrowth ?? 0).toFixed(1)}% rate vs last month
          </div>
        </div>

        <div {...cardProps('executives')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-purple/40"></div>
          <div className="text-[13px] font-bold text-text-muted">District Executives</div>
          <div className="text-[28px] font-black text-purple mt-1">{stats.districtExecutivesCount}</div>
          <div className="text-[11.5px] font-bold text-text-muted mt-2 flex items-center gap-1">
             Across {stats.industriesCount ?? 0} industries
          </div>
        </div>

        <div {...cardProps('calendar')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-red/40"></div>
          <div className="text-[13px] font-bold text-text-muted">Pending Leave Approvals</div>
          <div className="text-[28px] font-black text-red mt-1">{stats.pendingLeaves}</div>
          <div className="text-[11.5px] font-bold text-red mt-2 flex items-center gap-1">
             {stats.pendingLeaves > 0 ? `\u2191 ${stats.pendingLeaves} need attention` : '\u2191 All clear'}
          </div>
        </div>

        <div {...cardProps('performance')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-teal/40"></div>
          <div className="text-[13px] font-bold text-text-muted">Calls This Week</div>
          <div className="text-[28px] font-black text-teal mt-1">{stats.callsThisWeek}</div>
          <div className="text-[11.5px] font-bold text-green mt-2 flex items-center gap-1">
             {(stats.callsGrowthWeek ?? 0) >= 0 ? '\u2191' : '\u2193'} {Math.abs(stats.callsGrowthWeek ?? 0)}% vs last week
          </div>
        </div>

        <div {...cardProps('performance')}>
          <div className="absolute top-0 left-0 w-full h-1 bg-[#D97706]/40"></div>
          <div className="text-[13px] font-bold text-text-muted">Meetings Scheduled</div>
          <div className="text-[28px] font-black text-[#92400E] mt-1">{stats.meetingsScheduled}</div>
          <div className="text-[11.5px] font-bold text-text-muted mt-2 flex items-center gap-1">
             \u2192 {stats.meetingsVirtual ?? 0} virtual, {stats.meetingsDirect ?? 0} direct
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Industry Managers List */}
        <div className="lg:col-span-7 bg-surface1 rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <div>
              <h2 className="text-[15px] font-bold text-text-primary">Industry Managers {"\u00B7"} {user.state}</h2>
              <p className="text-[12px] text-text-muted mt-0.5">Drill in for full details</p>
            </div>
            <Button variant="outline" size="sm" className="text-[12px] h-8 px-4 font-bold border-border">View All</Button>
          </div>
          <div className="divide-y divide-border">
            {managers.map((m, idx) => (
              <div key={idx} className="p-5 flex items-center gap-4 hover:bg-surface2/30 transition-colors cursor-pointer group">
                <Avatar name={m.name} size="md" className={`av-${idx % 5}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="font-bold text-[14px] text-text-primary group-hover:text-blue transition-colors">{m.name}</div>
                    <div className="text-[11px] font-black text-text-muted uppercase tracking-wider">{m.efficiency}%</div>
                  </div>
                  <div className="text-[12px] text-text-muted mb-3">{m.industry} {"\u00B7"} {m.districts} Districts {"\u00B7"} {m.leadsCount} leads</div>
                  <div className="h-1.5 w-full bg-surface2 rounded-full overflow-hidden border border-border/50">
                    <div 
                      className="h-full bg-blue transition-all duration-1000 ease-out" 
                      style={{ width: `${m.efficiency}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex gap-6 ml-4">
                  <div className="text-center">
                    <div className="text-[14px] font-black text-text-primary">{m.calls}</div>
                    <div className="text-[9px] text-text-muted uppercase font-black tracking-tighter">Calls</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[14px] font-black text-text-primary">{m.conversions}</div>
                    <div className="text-[9px] text-text-muted uppercase font-black tracking-tighter">Conv.</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[14px] font-black text-teal">{formatCurrency(m.revenue)}</div>
                    <div className="text-[9px] text-text-muted uppercase font-black tracking-tighter">Rev.</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="lg:col-span-5 bg-surface1 rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <div>
              <h2 className="text-[15px] font-bold text-text-primary">Upcoming Events</h2>
              <p className="text-[12px] text-text-muted mt-0.5">Meetings, follow-ups, leave</p>
            </div>
            <div className="flex gap-1">
               {['Today', 'Tomorrow'].map(t => (
                 <button key={t} onClick={() => setEventFilter(t)} className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${eventFilter === t ? 'bg-blue/10 text-blue' : 'text-text-muted hover:bg-surface2'}`}>
                   {t}
                 </button>
               ))}
            </div>
          </div>
          <div className="p-5 flex flex-col gap-5">
            {events.map((e, i) => (
              <div
                key={i}
                onClick={() => goToLead(e._id)}
                className={`flex gap-4 group ${e._id ? 'cursor-pointer' : ''}`}
              >
                <div className="w-10 h-10 rounded-xl bg-surface2 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                   {e.type === 'meeting' ? '📹' : e.type === 'followup' ? '📞' : '📅'}
                </div>
                <div className="flex-1 border-b border-border/50 pb-4 group-last:border-0 group-last:pb-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[13.5px] font-bold text-text-primary group-hover:text-blue transition-colors">{e.title}</div>
                      <div className="text-[11.5px] text-text-muted mt-0.5">{e.subTitle}</div>
                      <div className="text-[11.5px] font-black text-blue mt-2 uppercase tracking-wide">
                        {new Date(e.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {new Date(e.time).toLocaleDateString() === new Date().toLocaleDateString() ? 'Today' : ''}
                      </div>
                    </div>
                    <Tag 
                      variant={e.type === 'meeting' ? 'teal' : e.type === 'followup' ? 'purple' : 'amber'} 
                      label={e.type} 
                      className="text-[9px] px-2 py-0.5 uppercase font-black"
                    />
                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && <div className="py-10 text-center text-[12px] text-text-muted italic">No upcoming events scheduled</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Lead Pipeline Chart */}
        <div className="lg:col-span-7 bg-surface1 rounded-2xl border border-border shadow-sm p-6">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-[15px] font-bold text-text-primary">Lead Pipeline {"\u00B7"} {user.state}</h2>
              <p className="text-[12px] text-text-muted mt-0.5">All industries combined</p>
            </div>
            <div className="flex gap-1 bg-surface2 p-1 rounded-lg">
               {['This Month', 'This Week'].map(t => (
                 <button key={t} onClick={() => setPipelineFilter(t)} className={`px-4 py-1.5 text-[11px] font-black rounded-md transition-all ${pipelineFilter === t ? 'bg-surface1 shadow-sm' : 'text-text-muted hover:text-text-primary'}`}>
                   {t}
                 </button>
               ))}
            </div>
          </div>
          <div className="space-y-5">
            {pipeline.map((p, i) => (
              <div key={i} className="flex items-center gap-6">
                <div className="w-[100px] text-[12px] font-bold text-text-secondary uppercase tracking-wider">{p.label}</div>
                <div className="flex-1 h-2.5 bg-surface2 rounded-full overflow-hidden border border-border/50">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm" 
                    style={{ 
                      width: `${(p.val / (stats.activeLeads || 1)) * 100}%`,
                      backgroundColor: p.color
                    }}
                  ></div>
                </div>
                <div className="w-10 text-right font-black text-[13px] text-text-primary">{p.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Requests */}
        <div className="lg:col-span-5 bg-surface1 rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border flex justify-between items-center">
            <div>
              <h2 className="text-[15px] font-bold text-text-primary">Leave Requests</h2>
              <p className="text-[12px] text-text-muted mt-0.5">Industry Managers &amp; Executives pending approval</p>
            </div>
            <Tag variant="amber" label={`${leaveRequests.length} Pending`} className="font-black text-[10px]" />
          </div>
          <div className="divide-y divide-border">
            {leaveRequests.map((r, i) => (
              <div key={i} className="p-5 flex items-center gap-4 group">
                <Avatar name={r.user.name} size="md" className={`av-${i % 5}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[14px] text-text-primary">{r.user.name}</div>
                  <div className="text-[11px] text-text-muted mt-0.5 truncate">
                    Industry Mgr {"\u00B7"} {r.user.industry} {"\u00B7"} {new Date(r.fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {"\u00B7"} {r.reason}
                  </div>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => leaveMutation.mutate({ id: r._id, status: 'approved' })}
                     className="px-3 py-1.5 bg-green/10 text-green text-[11px] font-black rounded-lg hover:bg-green hover:text-white transition-all border border-green/20"
                   >
                     Approve
                   </button>
                   <button 
                     onClick={() => leaveMutation.mutate({ id: r._id, status: 'rejected' })}
                     className="px-3 py-1.5 bg-red/10 text-red text-[11px] font-black rounded-lg hover:bg-red hover:text-white transition-all border border-red/20"
                   >
                     Reject
                   </button>
                </div>
              </div>
            ))}
            {leaveRequests.length === 0 && (
              <div className="p-10 text-center text-[12px] text-text-muted italic">No pending leave requests from managers</div>
            )}
            <div className="p-4 bg-surface2/30 border-t border-border">
               <button className="w-full py-2 text-[12px] font-bold text-text-secondary hover:text-blue transition-colors">Manage All Requests</button>
            </div>
          </div>
        </div>
      </div>

      {/* Expected Onboarding Table */}
      <div className="bg-surface1 rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div>
            <h2 className="text-[16px] font-bold text-text-primary">Expected Onboarding Leads {"\u00B7"} {user.state}</h2>
            <p className="text-[13px] text-text-muted mt-0.5">Track & manage leads across industries</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" size="sm" className="font-bold text-[12px] border-border shadow-sm">
                📊 1 Bulk Upload
             </Button>
             <Button 
                className="bg-blue hover:bg-blue-dark text-white font-bold text-[12px] border-none shadow-lg shadow-blue/20"
                onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'add-lead' }))}
             >
                + Add Lead
             </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="px-6 py-4 text-[11px] font-black text-text-muted uppercase tracking-wider">Lead ID</th>
                <th className="px-6 py-4 text-[11px] font-black text-text-muted uppercase tracking-wider">Business</th>
                <th className="px-6 py-4 text-[11px] font-black text-text-muted uppercase tracking-wider">Industry</th>
                <th className="px-6 py-4 text-[11px] font-black text-text-muted uppercase tracking-wider">District</th>
                <th className="px-6 py-4 text-[11px] font-black text-text-muted uppercase tracking-wider">Manager</th>
                <th className="px-6 py-4 text-[11px] font-black text-text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[11px] font-black text-text-muted uppercase tracking-wider text-right">Revenue</th>
                <th className="px-6 py-4 text-[11px] font-black text-text-muted uppercase tracking-wider text-center">Age</th>
                <th className="px-6 py-4 text-[11px] font-black text-text-muted uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expectedOnboarding.map((l, i) => (
                <tr
                  key={i}
                  onClick={() => goToLead(l._id)}
                  className="hover:bg-surface2/30 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4 font-mono text-[11.5px] font-black text-text-secondary">{l.leadId}</td>
                  <td className="px-6 py-4">
                    <div className="text-[14px] font-bold text-text-primary group-hover:text-blue transition-colors">{l.business}</div>
                    <div className="text-[11.5px] text-text-muted mt-0.5">{l.contact}</div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="px-3 py-1 bg-surface2 text-text-secondary text-[10px] font-black rounded-full uppercase tracking-wide border border-border/50">
                        {l.industry}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-[13px] font-bold text-text-secondary">{l.district}</td>
                  <td className="px-6 py-4 text-[13px] font-bold text-text-primary">{l.manager}</td>
                  <td className="px-6 py-4">
                     <Tag 
                       variant={l.priority === 'hot' ? 'red' : l.priority === 'warm' ? 'amber' : 'blue'} 
                       label={l.status.toUpperCase()} 
                       className="text-[10px] px-2 py-0.5 font-black uppercase"
                     />
                  </td>
                  <td className="px-6 py-4 text-[13.5px] font-black text-text-primary text-right">
                    {formatCurrency(l.revenue)}
                  </td>
                  <td className="px-6 py-4 text-[12px] font-bold text-text-muted text-center">{l.age}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); goToLead(l._id); }}
                      className="px-4 py-1.5 bg-surface2 hover:bg-border text-text-secondary text-[11px] font-bold rounded-lg transition-all border border-border"
                    >
                       View
                    </button>
                  </td>
                </tr>
              ))}
              {expectedOnboarding.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-6 py-20 text-center text-[13px] text-text-muted italic">
                    No leads found in current pipeline for onboarding
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

export default Overview;

