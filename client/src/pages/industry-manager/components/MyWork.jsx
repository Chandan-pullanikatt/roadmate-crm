import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  StatCard, 
  Button, 
  Tag, 
  Avatar,
  DataTable,
  FileUpload
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

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['leads', 'my-queue'],
    queryFn: () => leadsApi.getQueue().then(res => res.data)
  });

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data)
  });

  const startWorkMutation = useMutation({
    mutationFn: attendanceApi.startWork,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', 'summary']);
      addToast("Work started! Good luck.", "success");
    }
  });

  const endWorkMutation = useMutation({
    mutationFn: attendanceApi.endWork,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard', 'summary']);
      addToast("Work ended. Great job today!", "info");
    }
  });

  const transitionMutation = useMutation({
    mutationFn: (data) => leadsApi.transitionLead(data.id, data.action, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'my-queue']);
      addToast("Lead updated", "success");
    }
  });

  const workStarted = dashData?.attendance?.isWorking || false;
  const myLeads = queueData?.queue || [];
  const activeLead = myLeads[currentLeadIdx];
  const isLastLead = currentLeadIdx >= myLeads.length;

  const handleNext = (action, payload = {}) => {
    if (!activeLead) return;
    transitionMutation.mutate({ id: activeLead._id, action, payload });
  };

  if (queueLoading) return <div className="p-8 text-center text-text-muted">Loading your workspace...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl">My Workspace · {currentUser?.name}</h2>
          <p className="section-sub">Personal lead queue & district management tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <Tag variant={workStarted ? 'green' : 'amber'} label={workStarted ? '● Work Active' : '⏸ Work Not Started'} />
          <Button 
            className={workStarted ? 'bg-red text-white hover:bg-red/90' : 'bg-purple text-white hover:bg-purple/90'}
            onClick={() => workStarted ? endWorkMutation.mutate() : startWorkMutation.mutate()}
            disabled={startWorkMutation.isLoading || endWorkMutation.isLoading}
          >
            {workStarted ? '⏹ End Work' : '▶ Start Work'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tasks Today" value={myLeads.length} delta="Priority items" colorClass="purple" />
        <StatCard label="Efficiency" value={`${dashData?.attendance?.completionPct || 0}%`} delta="Work completion" colorClass="green" />
        <StatCard label="Personal Calls" value={dashData?.monthlyStats?.calls || 0} delta="This month" colorClass="blue" />
        <StatCard label="Conversions" value={dashData?.monthlyStats?.converted || 0} delta="Personal impact" colorClass="teal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="section-title">🎯 Active Item</h3>
                <p className="section-sub">
                  {!workStarted ? 'Start work to load your queue' : isLastLead ? 'Queue completed!' : `${activeLead.status.toUpperCase()} · ${activeLead.district}`}
                </p>
              </div>
              {workStarted && activeLead && <Tag variant={activeLead.priority === 'hot' ? 'red' : 'blue'} label={activeLead.priority?.toUpperCase()} />}
            </div>
            <div className="card-body min-h-[240px] flex flex-col justify-center">
              {!workStarted ? (
                <div className="text-center py-10 text-text-muted">
                  <div className="text-5xl mb-4">🧑‍💼</div>
                  <div className="font-semibold text-lg mb-2">Press "Start Work" to begin</div>
                  <div className="text-sm">Access your high-priority district leads and partner follow-ups.</div>
                </div>
              ) : isLastLead ? (
                <div className="text-center py-10 text-accent">
                  <div className="text-5xl mb-4">🎉</div>
                  <div className="font-bold text-xl mb-2">All tasks completed!</div>
                  <Button className="bg-accent text-white hover:bg-accent/90" onClick={() => endWorkMutation.mutate()}>✓ Finish Today's Work</Button>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xl font-bold">{activeLead.company}</h4>
                      <p className="text-sm text-text-muted">Contact: {activeLead.name}</p>
                      <p className="text-sm text-blue font-bold mt-1">{activeLead.phone}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-surface2 p-3 rounded-xl border border-border">
                      <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">District</div>
                      <div className="font-bold text-sm mt-1">{activeLead.district}</div>
                    </div>
                    <div className="bg-surface2 p-3 rounded-xl border border-border">
                      <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Status</div>
                      <div className="font-bold text-sm mt-1 uppercase">{activeLead.status}</div>
                    </div>
                    <div className="bg-surface2 p-3 rounded-xl border border-border">
                      <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">RNR Count</div>
                      <div className={`font-bold text-sm mt-1 font-mono ${activeLead.rnrCount > 0 ? 'text-amber' : 'text-text-muted'}`}>
                        {activeLead.rnrCount}/3
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button className="bg-accent text-white hover:bg-accent/90" onClick={() => handleNext('call_done')}>✓ Call Done</Button>
                    <Button variant="outline" className="text-amber border-amber/30" onClick={() => handleNext('rnr')}>📵 RNR</Button>
                    <Button className="bg-blue text-white hover:bg-blue/90" onClick={() => handleNext('meeting_scheduled', { meetingTime: new Date() })}>📅 Meeting Set</Button>
                    <Button variant="outline" onClick={() => setCurrentLeadIdx(prev => prev + 1)}>⏭ Skip</Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="section-title">My Full Queue</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface2/50 text-text-muted uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3">Business</th>
                    <th className="px-4 py-3">District</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myLeads.map((l, idx) => (
                    <tr key={idx} className="hover:bg-surface2/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-xs">{l.company}</td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{l.district}</td>
                      <td className="px-4 py-3">
                        <Tag variant={l.priority === 'hot' ? 'red' : 'blue'} label={l.status.toUpperCase()} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="xs" variant="outline" onClick={() => { setCurrentLeadIdx(idx); }}>Work</Button>
                      </td>
                    </tr>
                  ))}
                  {myLeads.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-text-muted italic">Queue empty</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="section-title">Queue Progress</h3>
            </div>
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {myLeads.map((l, idx) => {
                const isCurrent = idx === currentLeadIdx && workStarted;
                const isDone = idx < currentLeadIdx;
                
                return (
                  <div 
                    key={idx} 
                    className={`p-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-surface2/50 ${isCurrent ? 'bg-purple-light/50 border-l-4 border-purple' : ''}`}
                    onClick={() => workStarted && setCurrentLeadIdx(idx)}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isDone ? 'bg-accent' : isCurrent ? 'bg-purple' : 'bg-border2'}`} />
                    <div className="flex-1 min-width-0">
                      <div className={`text-xs font-bold truncate ${isDone ? 'text-text-muted line-through' : 'text-text-primary'}`}>{l.company}</div>
                      <div className="text-[10px] text-text-muted">{l.district} · {l.name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyWork;
