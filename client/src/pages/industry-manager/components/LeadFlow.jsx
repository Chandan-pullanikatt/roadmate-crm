import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  StatCard, 
  Tag, 
  Button,
  Avatar,
  TaskStep,
  DashboardSkeleton
} from '../../../components/ui';
import { leadsApi } from '../../../api/leadsApi';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';

const LeadFlow = () => {
  const [selectedExecId, setSelectedExecId] = useState('');

  // 1. Get Industry Manager Profile
  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  // 2. Get Executives for monitoring
  const { data: executives, isLoading: execsLoading } = useQuery({
    queryKey: ['users', 'executives-monitoring'],
    queryFn: () => usersApi.getUsers({ role: 'executive' }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  // 3. Get Selected Executive's Queue & Activity
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['leads', 'monitoring-queue', selectedExecId],
    queryFn: () => leadsApi.getLeadQueue(selectedExecId).then(res => res.data),
    enabled: !!selectedExecId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  const activeLead = queueData?.currentLead;
  const selectedExec = executives?.find(e => e._id === selectedExecId);
  const userInfo = dashData?.user || {};

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  if ((dashLoading || execsLoading) && !dashData) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
             <div className="px-2.5 py-1 rounded-md bg-purple-light text-purple text-[10px] font-bold uppercase tracking-wider border border-purple/10">
                Shadow Monitor
             </div>
             <span className="text-text-muted opacity-30">/</span>
             <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Live Task Flow</span>
          </div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
            Lead Task Flow
          </h1>
          <p className="text-sm text-text-muted mt-1 font-medium">
            Shadowing {selectedExec ? selectedExec.name : 'Executive Queue'} <span className="mx-2 opacity-30">·</span> {userInfo.industry}
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-border/60 shadow-sm">
            <div className="pr-2 pl-4">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-tight">Monitoring</div>
                <div className="text-sm font-bold text-purple">{selectedExecId ? '1 Active Session' : 'No Session Selected'}</div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="bg-surface2 border border-border rounded-xl p-1 flex mr-1">
                <select 
                    className="bg-transparent border-none text-[11px] font-bold px-4 py-2 outline-none cursor-pointer"
                    value={selectedExecId}
                    onChange={(e) => setSelectedExecId(e.target.value)}
                >
                    <option value="">Select Executive</option>
                    {executives?.map(e => (
                        <option key={e._id} value={e._id}>{e.name} ({e.district})</option>
                    ))}
                </select>
            </div>
        </div>
      </div>

      {!selectedExecId ? (
          <div className="p-32 text-center border-2 border-dashed border-border/30 rounded-[3rem] bg-surface2/30 animate-in zoom-in-95 duration-700">
             <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center text-4xl shadow-xl shadow-purple/5 border border-purple/10 mx-auto mb-8">
                 👁️‍🗨️
             </div>
             <h3 className="text-2xl font-black text-text-primary tracking-tight">Monitor Active Execution</h3>
             <p className="text-sm text-text-muted max-w-sm mx-auto mt-4 font-medium leading-relaxed">
                Select a District Executive from the monitor control above to shadow their current lead processing workflow in real-time.
             </p>
          </div>
      ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in slide-in-from-bottom-6 duration-700">
            {/* Left Content (7 cols) */}
            <div className="lg:col-span-7 space-y-8">
                {/* Active Lead Card */}
                <div className="card shadow-lg shadow-purple/5 relative overflow-hidden border-purple/10 ring-1 ring-purple/5">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple/5 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
                    <div className="p-8 relative z-10">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-light flex items-center justify-center text-lg shadow-inner">🎯</div>
                                <div>
                                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Currently Working On</h3>
                                    <div className="text-sm font-bold text-purple">{activeLead?.leadId || 'WAITING FOR QUEUE...'}</div>
                                </div>
                            </div>
                            <Tag variant={activeLead?.priority === 'hot' ? 'red' : 'blue'} label={activeLead?.priority?.toUpperCase() || 'NORMAL'} className="px-4 py-1.5 rounded-xl font-black shadow-sm" />
                        </div>

                        {!activeLead ? (
                            <div className="py-20 text-center">
                                <div className="text-5xl mb-4 opacity-20">🧊</div>
                                <p className="text-sm text-text-muted font-bold italic tracking-tight">Executive is currently idle or awaiting next task...</p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-10">
                                    <h4 className="text-3xl font-black text-text-primary tracking-tighter mb-2">{activeLead.company || activeLead.name}</h4>
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted font-bold">
                                        <span className="flex items-center gap-2 bg-surface2 px-3 py-1.5 rounded-lg border border-border/40">
                                            <span className="opacity-50">Contact:</span> {activeLead.name}
                                        </span>
                                        <span className="flex items-center gap-2 bg-surface2 px-3 py-1.5 rounded-lg border border-border/40">
                                            <span className="opacity-50">Phone:</span> {activeLead.phone}
                                        </span>
                                        <span className="flex items-center gap-2 bg-purple-light/50 text-purple px-3 py-1.5 rounded-lg border border-purple/10">
                                            <span className="opacity-50">District:</span> {activeLead.district}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-10">
                                    <div className="p-4 bg-surface2/50 rounded-2xl border border-border/40">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5">Last Action</p>
                                        <p className="text-xs font-bold text-text-primary">Call Attempt</p>
                                    </div>
                                    <div className="p-4 bg-surface2/50 rounded-2xl border border-border/40">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5">RNR Status</p>
                                        <p className={`text-xs font-bold ${activeLead.rnrCount > 0 ? 'text-amber' : 'text-text-muted'}`}>{activeLead.rnrCount || 0}/3 Re-calls</p>
                                    </div>
                                    <div className="p-4 bg-surface2/50 rounded-2xl border border-border/40">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5">Lead Age</p>
                                        <p className="text-xs font-bold text-text-primary">3 Days</p>
                                    </div>
                                    <div className="p-4 bg-surface2/50 rounded-2xl border border-border/40">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1.5">Current Phase</p>
                                        <p className="text-xs font-bold text-purple uppercase tracking-tight">{activeLead.status || 'New'}</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 pt-8 border-t border-border/40">
                                    <div className="text-[10px] font-bold text-text-muted uppercase mr-2 tracking-widest">Actions Logged:</div>
                                    <div className="flex gap-2">
                                        {activeLead.rnrCount > 0 && <Tag variant="amber" label={`${activeLead.rnrCount}x RNR`} className="px-3 rounded-lg" />}
                                        {activeLead.status === 'followup' && <Tag variant="blue" label="Follow-up Set" className="px-3 rounded-lg" />}
                                        <div className="px-3 py-1.5 rounded-lg bg-surface2 border border-border text-[10px] font-bold text-text-muted">Direct Session</div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* RNR Rules Protocol */}
                <div className="card border-border/40 shadow-sm bg-white overflow-hidden">
                    <div className="bg-surface2/50 px-8 py-4 border-b border-border/40 flex items-center justify-between">
                        <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">RNR Protocol Engine</h3>
                        <div className="px-2 py-0.5 rounded bg-red text-white text-[9px] font-bold">AUTOMATED RULES</div>
                    </div>
                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { title: '1st RNR (AM)', desc: 'Lead re-queued for afternoon session', color: 'bg-amber' },
                                { title: '2nd RNR (PM)', desc: 'Moves to next working day AM', color: 'bg-amber' },
                                { title: '3rd RNR (D2)', desc: 'Different time-slot after 48 hours', color: 'bg-red' },
                                { title: 'Multi-RNR', desc: 'Auto-reallocate to new Executive', color: 'bg-blue' }
                            ].map((rule, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-surface/50 border border-border/30 hover:bg-white hover:border-purple/20 transition-all group cursor-default">
                                    <div className={`w-2 h-2 rounded-full ${rule.color} group-hover:scale-150 transition-transform`}></div>
                                    <div>
                                        <div className="text-[11px] font-black text-text-primary tracking-tight">{rule.title}</div>
                                        <div className="text-[10px] text-text-muted font-medium">{rule.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Content (5 cols) */}
            <div className="lg:col-span-5 space-y-8">
                {/* Live Task Timeline */}
                <div className="card border-border/40 shadow-lg shadow-purple/5">
                    <div className="card-header border-none px-8 pt-8">
                        <h3 className="text-sm font-black uppercase tracking-widest text-text-muted">Live Execution Timeline</h3>
                        <div className="w-2 h-2 rounded-full bg-green animate-pulse shadow-sm shadow-green/40"></div>
                    </div>
                    <div className="card-body px-8 pt-4 pb-8 space-y-5">
                        <TaskStep 
                            step={1} 
                            status="done" 
                            title="Primary Call Initiated" 
                            subtitle="10:14 AM · First Contact" 
                            icon="✓"
                            iconClass="bg-green text-white border-none shadow-sm shadow-green/20"
                        />
                        <TaskStep 
                            step={2} 
                            status={activeLead?.rnrCount > 0 ? "done" : "pending"} 
                            title="RNR Rules Triggered" 
                            subtitle={activeLead?.rnrCount > 0 ? "Automatic Re-queue PM" : "Awaiting Result"} 
                            icon={activeLead?.rnrCount > 0 ? "✓" : "2"}
                            iconClass={activeLead?.rnrCount > 0 ? "bg-amber text-white border-none shadow-sm shadow-amber/20" : ""}
                        />
                        <TaskStep 
                            step={3} 
                            status="active" 
                            title="Shadowing Session" 
                            subtitle="Live · Monitoring active" 
                            className="border-purple/40 bg-purple/5 ring-2 ring-purple/5"
                        />
                        <TaskStep 
                            step={4} 
                            status="pending" 
                            title="Feedback & Scheduling" 
                            subtitle="Awaiting input" 
                        />
                        <TaskStep 
                            step={5} 
                            status="pending" 
                            title="Conversion Phase" 
                            subtitle="Awaiting progress" 
                        />
                    </div>
                </div>

                {/* Executive Queue Snapshot */}
                <div className="card border-border/40 shadow-sm overflow-hidden">
                    <div className="card-header border-none px-8 pt-8">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-text-muted">Executive Queue</h3>
                            <p className="text-[10px] text-text-muted font-bold mt-1">Today's Active Tasks</p>
                        </div>
                    </div>
                    <div className="divide-y divide-border/40 max-h-[380px] overflow-y-auto scrollbar-hide">
                        {(queueData || []).slice(0, 5).map((lead, idx) => (
                            <div key={idx} className={`px-8 py-4 flex items-center gap-4 transition-all hover:bg-surface/50 group cursor-pointer ${idx === 0 ? 'bg-purple-light/20 border-l-4 border-purple' : ''}`}>
                                <div className="w-8 h-8 rounded-lg bg-surface2 flex items-center justify-center text-[10px] font-black text-text-muted group-hover:bg-white transition-colors">
                                    0{idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-black text-text-primary truncate group-hover:text-purple transition-colors">
                                        {lead.company || lead.name}
                                    </div>
                                    <div className="text-[10px] text-text-muted font-bold flex items-center gap-2 mt-0.5">
                                        {lead.district} <span className="opacity-30">·</span> {lead.status}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] font-black text-purple/60 mb-0.5">EST. TIME</div>
                                    <div className="text-[10px] font-black text-text-primary">1{idx}:30 AM</div>
                                </div>
                            </div>
                        ))}
                        {(!queueData || queueData.length === 0) && (
                            <div className="p-12 text-center text-[10px] font-bold text-text-muted uppercase tracking-widest italic opacity-50">
                                No further tasks in queue
                            </div>
                        )}
                    </div>
                    <div className="p-6 bg-surface2/50 border-t border-border/40 text-center">
                        <Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-widest border-none hover:bg-purple hover:text-white transition-all">
                            View Full Daily Queue
                        </Button>
                    </div>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default LeadFlow;
