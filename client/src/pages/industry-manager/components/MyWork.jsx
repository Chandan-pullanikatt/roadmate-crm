import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  StatCard, 
  Button, 
  Tag, 
  Avatar,
  DataTable,
  DashboardSkeleton
} from '../../../components/ui';
import { leadsApi } from '../../../api/leadsApi';
import { attendanceApi } from '../../../api/attendanceApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';

const MyWork = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  
  const [currentLeadIdx, setCurrentLeadIdx] = useState(0);
  const [tableFilter, setTableFilter] = useState('All');
  const [strategyNote, setStrategyNote] = useState('');

  // 1. Fetch Personal Stats
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  // 2. Fetch Lead Queue
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['leads', 'my-queue'],
    queryFn: () => leadsApi.getQueue().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  // 3. Fetch All My Leads for the table
  const { data: allLeadsData } = useQuery({
    queryKey: ['leads', 'personal-list'],
    queryFn: () => leadsApi.getLeads({ owner: currentUser?._id, limit: 100 }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  const startWorkMutation = useMutation({
    mutationFn: attendanceApi.startWork,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', 'executive']);
      addToast("Work started! Good luck.", "success");
    }
  });

  const endWorkMutation = useMutation({
    mutationFn: attendanceApi.endWork,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', 'executive']);
      addToast("Work ended. Great job today!", "info");
    }
  });

  const transitionMutation = useMutation({
    mutationFn: (data) => leadsApi.transitionLead(data.id, data.action, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'my-queue']);
      queryClient.invalidateQueries(['dashboard', 'executive']);
      addToast("Lead updated", "success");
    }
  });

  const saveStrategyMutation = useMutation({
    mutationFn: (note) => dashboardApi.saveStrategy({ note }),
    onSuccess: () => {
        setStrategyNote('');
        queryClient.invalidateQueries(['dashboard', 'executive']);
        addToast("Strategy logged", "success");
    }
  });

  const openModal = (type, data = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', { 
      detail: typeof type === 'string' ? { type, ...data } : type 
    }));
  };

  const workStarted = dashData?.workStarted || false;
  const myQueue = queueData || [];
  const activeLead = myQueue[currentLeadIdx];
  const isQueueEmpty = myQueue.length === 0;
  const isLastLead = currentLeadIdx >= myQueue.length;

  const filteredLeads = useMemo(() => {
    const leads = allLeadsData?.leads || [];
    if (tableFilter === 'All') return leads;
    if (tableFilter === 'Hot') return leads.filter(l => l.priority === 'hot');
    return leads.filter(l => l.status === tableFilter.toLowerCase());
  }, [allLeadsData, tableFilter]);

  const formatCurrency = (val) => {
    if (val >= 100000) return `\u20B9${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `\u20B9${(val / 1000).toFixed(1)}K`;
    return `\u20B9${val}`;
  };

  const handleNext = (action, payload = {}) => {
    if (!activeLead) return;
    transitionMutation.mutate({ id: activeLead._id, action, payload });
  };

  if ((dashLoading || queueLoading) && !dashData) return <DashboardSkeleton />;

  const todayStats = dashData?.todayStats || {};
  const weeklyStats = dashData?.weeklyStats || {};
  const monthlyStats = dashData?.monthlyStats || {};

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">My Work</h1>
          <p className="text-sm text-text-muted">Your personal lead queue · District Partner leads · Work it yourself</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Search leads, executives..." 
                    className="pl-10 pr-4 py-2 bg-surface2 border border-border rounded-xl text-sm focus:ring-2 focus:ring-purple/20 transition-all outline-none min-w-[280px]"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-lg">🔍</span>
            </div>
            <button className="w-10 h-10 rounded-xl bg-surface2 border border-border flex items-center justify-center hover:bg-surface3 transition-colors relative">
                <span className="text-lg">🔔</span>
            </button>
            <Avatar name={dashData?.user?.name} size="md" className="border-2 border-purple/10" />
        </div>
      </div>

      {/* Sub Header / Work Status */}
      <div className="bg-surface1 border border-border/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold">My Work {"\u2014"} {dashData?.user?.name} {"\u00B7"} {dashData?.user?.industry}</h2>
          <p className="text-xs text-text-muted">Your personal lead queue {"\u00B7"} District Partner leads {"\u00B7"} One-by-one execution</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber/10 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-amber animate-pulse" />
            <span className="text-[10px] font-bold text-amber uppercase tracking-wider">{workStarted ? 'Work Active' : 'Work Not Started'}</span>
          </div>
          <Button 
            className={`${workStarted ? 'bg-red' : 'bg-purple'} text-white border-none rounded-xl px-6`}
            onClick={() => workStarted ? endWorkMutation.mutate(dashData?.attendance?._id) : startWorkMutation.mutate()}
          >
            {workStarted ? 'Stop Work' : 'Start Work'}
          </Button>
          <Button 
            variant="outline"
            className="bg-white border-purple/30 text-purple hover:bg-purple/5 rounded-xl px-5 font-bold"
            onClick={() => openModal('create-exec', {
              prefill: {
                role: 'executive',
                state: currentUser?.state || '',
                industry: currentUser?.industry || '',
                reportingTo: currentUser?._id || '',
              }
            })}
          >
            + Onboard Executive
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
            label="My Leads Today" 
            value={todayStats.totalLeads || 0} 
            delta={`\u2192 ${todayStats.followups || 0} follow-ups, ${todayStats.totalLeads - todayStats.followups} new`} 
            deltaType="up"
            deltaLabel=""
            colorClass="purple" 
        />
        <StatCard 
            label="Completed Today" 
            value={todayStats.completedLeads || 0} 
            delta={`of ${todayStats.totalLeads || 0} total tasks`}
            deltaType="up"
            deltaLabel=""
            colorClass="green" 
        />
        <StatCard 
            label="My Calls This Week" 
            value={weeklyStats.calls || 0} 
            delta={`\u2191 ${weeklyStats.callGrowth || 0}`}
            deltaType="up"
            deltaLabel="vs last week"
            colorClass="blue" 
        />
        <StatCard 
            label="My Conversions" 
            value={monthlyStats.converted || 0} 
            delta="This month"
            deltaType="up"
            deltaLabel=""
            colorClass="teal" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Lead Section */}
        <div className="lg:col-span-2 card overflow-hidden flex flex-col">
            <div className="card-header border-none pb-0">
                <div className="flex items-center gap-2">
                    <span className="text-rose text-lg">🎯</span>
                    <div>
                        <h3 className="section-title text-base">Active Lead</h3>
                        <p className="section-sub">Start work to load your first lead</p>
                    </div>
                </div>
                <Tag variant="surface2" label="Waiting" />
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center py-16 px-8 text-center">
                {!workStarted ? (
                    <div className="space-y-4 animate-in fade-in duration-700">
                        <div className="w-24 h-24 rounded-full bg-surface2 flex items-center justify-center text-4xl mx-auto border border-border/50">
                            👨‍💼
                        </div>
                        <div>
                            <h4 className="text-xl font-bold text-text-primary">Press "Start Work" to begin your session</h4>
                            <p className="text-sm text-text-muted mt-2 max-w-sm mx-auto">Leads will appear one-by-one · Direct meetings first, then follow-ups, then new leads</p>
                        </div>
                    </div>
                ) : isQueueEmpty ? (
                    <div className="space-y-4">
                        <div className="text-5xl">✅</div>
                        <h4 className="text-xl font-bold">Queue Completed!</h4>
                        <p className="text-sm text-text-muted">You've worked through all your tasks for now.</p>
                    </div>
                ) : isLastLead ? (
                    <div className="space-y-4">
                        <div className="text-5xl">🙌</div>
                        <h4 className="text-xl font-bold">End of Queue</h4>
                        <Button variant="outline" onClick={() => setCurrentLeadIdx(0)}>Restart Queue</Button>
                    </div>
                ) : (
                    <div className="w-full text-left space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                         <div className="flex justify-between items-start">
                            <div>
                                <h4 className="text-2xl font-bold text-text-primary">{activeLead.company || activeLead.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-text-muted">Contact: <span className="text-text-primary font-semibold">{activeLead.name}</span></span>
                                    <span className="w-1 h-1 rounded-full bg-border2" />
                                    <span className="text-xs text-purple font-bold tracking-tight">{activeLead.phone}</span>
                                </div>
                            </div>
                            <Tag variant={activeLead.priority === 'hot' ? 'red' : 'blue'} label={activeLead.priority?.toUpperCase()} />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 rounded-xl bg-surface2 border border-border/50">
                                <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">District</div>
                                <div className="text-sm font-bold text-text-primary">{activeLead.district}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-surface2 border border-border/50">
                                <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">Status</div>
                                <div className="text-sm font-bold text-purple uppercase">{activeLead.status}</div>
                            </div>
                            <div className="p-3 rounded-xl bg-surface2 border border-border/50">
                                <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">RNR Count</div>
                                <div className="text-sm font-bold text-amber">{activeLead.rnrCount || 0}x RNR</div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-4">
                            <Button className="bg-purple text-white border-none rounded-xl px-6 py-2.5 h-auto font-bold shadow-lg shadow-purple/10" onClick={() => handleNext('mark_called')}>✓ Call Done</Button>
                            <Button className="bg-amber text-white border-none rounded-xl px-6 py-2.5 h-auto font-bold" onClick={() => handleNext('mark_rnr')}>📵 RNR</Button>
                            <Button className="bg-blue text-white border-none rounded-xl px-6 py-2.5 h-auto font-bold" onClick={() => handleNext('set_feedback', { nextAction: 'schedule_virtual', meetingAt: new Date() })}>📅 Meeting Set</Button>
                            <Button variant="outline" className="rounded-xl px-6 py-2.5 h-auto font-bold" onClick={() => setCurrentLeadIdx(prev => prev + 1)}>⏭ Skip</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Today's Queue List */}
        <div className="card overflow-hidden">
            <div className="card-header border-none">
                <h3 className="section-title text-base font-bold">Today's Queue {"\u00B7"} My Leads</h3>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Direct meetings {"\u2192"} Follow-ups {"\u2192"} New leads</p>
            </div>
            <div className="divide-y divide-border/50 max-h-[420px] overflow-y-auto">
                {myQueue.map((lead, idx) => (
                    <div 
                        key={lead._id} 
                        onClick={() => setCurrentLeadIdx(idx)}
                        className={`p-4 flex items-center gap-4 cursor-pointer transition-all hover:bg-surface2 ${currentLeadIdx === idx ? 'bg-purple-light/30 border-l-4 border-purple' : ''}`}
                    >
                        <div className="text-[10px] font-bold text-text-muted w-4">{idx + 1}</div>
                        <div className="flex-1 min-width-0">
                            <div className="text-sm font-bold text-text-primary truncate">{lead.company || lead.name}</div>
                            <div className="text-[11px] text-text-muted truncate">{lead.district} {"\u00B7"} {lead.name}</div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-[10px] font-bold text-text-muted">9:30 AM</div>
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                                <span className={`text-[9px] font-bold uppercase tracking-tighter ${lead.status === 'followup' ? 'text-amber' : 'text-blue'}`}>
                                    {lead.status?.replace('_', ' ')}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
                {isQueueEmpty && <div className="p-12 text-center text-text-muted bg-surface1/50 italic">Queue empty</div>}
            </div>
            <div className="p-4 bg-surface2 border-t border-border/50 text-center">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{todayStats.completedLeads || 0}/{myQueue.length} completed today</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Lead Sources Side List */}
          <div className="card">
              <div className="card-header border-none pb-2">
                  <h3 className="section-title text-base">My Lead Sources</h3>
                  <p className="section-sub">Leads from District Partners · Mapped to me</p>
              </div>
              <div className="p-4 space-y-3">
                  {dashData?.leadSources?.map((source, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-surface2 rounded-xl border border-border/50 hover:border-purple/30 transition-colors cursor-pointer group">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform">{source.icon}</div>
                              <div>
                                  <div className="text-xs font-bold text-text-primary">{source.label}</div>
                                  <div className="text-[10px] text-text-muted">District Partner Leads</div>
                              </div>
                          </div>
                          <div className="text-sm font-bold text-purple">{source.count} leads</div>
                      </div>
                  ))}
                  <div className="pt-2">
                    <Tag variant="purple" label="District Partner Leads" className="w-full justify-center py-2" />
                  </div>
              </div>
          </div>

          {/* All Leads Table */}
          <div className="lg:col-span-3 card">
            <div className="card-header border-none pb-4">
                <div>
                    <h3 className="section-title text-base font-bold">My All Leads {"\u00B7"} {dashData?.user?.industry} {"\u00B7"} {dashData?.user?.state}</h3>
                    <p className="section-sub">Leads assigned to me from district partners across all districts</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-surface2 p-1 rounded-lg">
                        {['All', 'Hot', 'Follow-up', 'RNR', 'Converted'].map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setTableFilter(tab)}
                                className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${tableFilter === tab ? 'bg-white shadow-sm text-purple' : 'text-text-muted hover:text-text-primary'}`}
                            >{tab}</button>
                        ))}
                    </div>
                    <Button 
                        size="sm" 
                        className="bg-purple text-white hover:bg-purple-dark rounded-xl px-5 h-9 font-bold"
                        onClick={() => openModal('add-lead')}
                    >
                        + Add Lead
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-surface2/50 text-[9px] font-black text-text-muted uppercase tracking-widest border-y border-border/50">
                        <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">PARTNER / BUSINESS</th>
                            <th className="px-6 py-4">DISTRICT</th>
                            <th className="px-6 py-4">SOURCE</th>
                            <th className="px-6 py-4">STATUS</th>
                            <th className="px-6 py-4">RNR</th>
                            <th className="px-6 py-4">REVENUE</th>
                            <th className="px-6 py-4 text-right">ACTION</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {filteredLeads.map((lead, idx) => (
                            <tr key={lead._id} className="hover:bg-surface1 transition-colors group">
                                <td className="px-6 py-4 text-[10px] font-bold text-text-muted">MN-{idx+1 < 10 ? `0${idx+1}` : idx+1}</td>
                                <td className="px-6 py-4">
                                    <div className="text-xs font-bold text-text-primary">{lead.company || lead.name}</div>
                                    <div className="text-[10px] text-text-muted mt-0.5">{lead.name} {"\u00B7"} {lead.phone}</div>
                                </td>
                                <td className="px-6 py-4 text-xs text-text-secondary">{lead.district}</td>
                                <td className="px-6 py-4">
                                    <Tag variant="surface2" label={lead.source || 'District Partner'} className="text-[9px] px-2" />
                                </td>
                                <td className="px-6 py-4">
                                    <Tag 
                                        variant={lead.priority === 'hot' ? 'red' : lead.status === 'converted' ? 'green' : 'amber'} 
                                        label={lead.status?.toUpperCase()} 
                                        className="text-[9px] px-2"
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] font-bold ${lead.rnrCount > 0 ? 'text-amber' : 'text-text-muted opacity-40'}`}>
                                        {lead.rnrCount > 0 ? `${lead.rnrCount}x RNR` : '\u2014'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs font-bold text-text-primary">
                                    {lead.expectedRevenue ? formatCurrency(lead.expectedRevenue) : '—'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button size="xs" variant="outline" className="font-bold text-[9px] uppercase tracking-wider" onClick={() => openModal('update-lead', { leadData: lead })}>Update</Button>
                                        <Button size="xs" variant="outline" className="text-purple border-purple/10 font-bold text-[9px] uppercase tracking-wider" onClick={() => openModal('allocate-lead', { leadData: lead })}>Allocate</Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredLeads.length === 0 && <div className="p-16 text-center text-text-muted italic">No leads found with this filter</div>}
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Performance Summary */}
          <div className="lg:col-span-3 card">
              <div className="card-header border-none">
                  <h3 className="section-title text-base font-bold">My Performance {"\u00B7"} This Month</h3>
              </div>
              <div className="card-body">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <div className="p-4 bg-surface2 rounded-2xl text-center border border-border/50">
                          <div className="text-xl font-black text-purple">{monthlyStats.totalCalls || 0}</div>
                          <div className="text-[9px] text-text-muted uppercase font-bold tracking-widest mt-1">Total Calls</div>
                      </div>
                      <div className="p-4 bg-surface2 rounded-2xl text-center border border-border/50">
                          <div className="text-xl font-black text-blue">{monthlyStats.totalMeetings || 0}</div>
                          <div className="text-[9px] text-text-muted uppercase font-bold tracking-widest mt-1">Meetings</div>
                      </div>
                      <div className="p-4 bg-surface2 rounded-2xl text-center border border-border/50">
                          <div className="text-xl font-black text-teal">{monthlyStats.converted || 0}</div>
                          <div className="text-[9px] text-text-muted uppercase font-bold tracking-widest mt-1">Conversions</div>
                      </div>
                      <div className="p-4 bg-surface2 rounded-2xl text-center border border-border/50">
                          <div className="text-xl font-black text-green">{formatCurrency(monthlyStats.revenue || 0)}</div>
                          <div className="text-[9px] text-text-muted uppercase font-bold tracking-widest mt-1">Revenue</div>
                      </div>
                  </div>
                  <div>
                      <div className="flex justify-between items-end mb-2 px-1">
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Work Completion</span>
                          <span className="text-sm font-black text-purple">{dashData?.attendance?.completionPct || 0}%</span>
                      </div>
                      <div className="h-2 bg-surface2 rounded-full overflow-hidden border border-border/50">
                          <div 
                            className="h-full bg-gradient-to-r from-purple to-purple-dark transition-all duration-1000" 
                            style={{ width: `${dashData?.attendance?.completionPct || 0}%` }}
                          />
                      </div>
                  </div>
              </div>
          </div>

          {/* Strategy Log */}
          <div className="lg:col-span-2 card flex flex-col">
              <div className="card-header border-none pb-2">
                  <h3 className="section-title text-base font-bold">My Strategy Log</h3>
              </div>
              <div className="flex-1 p-4 space-y-4">
                  <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest px-1">What strategy worked for recent conversions?</p>
                  
                  <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2">
                      {dashData?.strategyLogs?.map((log, idx) => (
                          <div key={idx} className="p-3 bg-green-light/20 border border-green/10 rounded-xl">
                              <div className="flex justify-between items-start mb-1">
                                  <div className="text-xs font-bold text-text-primary">{log.leadName}</div>
                                  <Tag variant="green" label="Converted" className="text-[8px] py-0 px-1.5" />
                              </div>
                              <div className="text-[10px] text-text-muted italic leading-relaxed">
                                  Strategy: {log.strategy}
                              </div>
                          </div>
                      ))}
                      {dashData?.strategyLogs?.length === 0 && <div className="p-4 text-center text-text-muted text-[10px] italic">No recent conversions logged</div>}
                  </div>

                  <div className="mt-auto space-y-3 pt-2">
                      <textarea 
                        className="w-full bg-surface2 border border-border/50 rounded-xl p-3 text-xs focus:ring-2 focus:ring-purple/20 transition-all outline-none resize-none"
                        placeholder="Log today's winning strategy.."
                        rows="2"
                        value={strategyNote}
                        onChange={(e) => setStrategyNote(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button 
                            className="bg-purple text-white border-none rounded-lg px-4 py-1.5 h-auto text-[10px] font-bold uppercase tracking-wider"
                            onClick={() => saveStrategyMutation.mutate(strategyNote)}
                            disabled={!strategyNote || saveStrategyMutation.isLoading}
                        >
                            Save Strategy
                        </Button>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default MyWork;
