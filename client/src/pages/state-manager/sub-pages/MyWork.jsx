import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../../../api/leadsApi';
import { attendanceApi } from '../../../api/attendanceApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag, DataTable } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';

const MyWork = ({ openModal }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const [currentLeadIdx, setCurrentLeadIdx] = useState(0);

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['leads', 'my-queue-sm'],
    queryFn: () => leadsApi.getQueue().then(res => res.data)
  });

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'summary-sm'],
    queryFn: () => dashboardApi.getExecutiveDashboard().then(res => res.data)
  });

  const startWorkMutation = useMutation({
    mutationFn: attendanceApi.startWork,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard']);
      addToast("Work session started", "success");
    }
  });

  const endWorkMutation = useMutation({
    mutationFn: attendanceApi.endWork,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard']);
      addToast("Work session ended", "info");
    }
  });

  const transitionMutation = useMutation({
    mutationFn: (data) => leadsApi.transitionLead(data.id, data.action, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'my-queue-sm']);
      addToast("Lead status updated", "success");
    }
  });

  const isWorking = dashData?.attendance?.isWorking || false;
  const myLeads = queueData?.queue || [];
  const currentLead = myLeads[currentLeadIdx];
  const isLastLead = currentLeadIdx >= myLeads.length;

  const handleAction = (action, payload = {}) => {
    if (!currentLead) return;
    transitionMutation.mutate({ id: currentLead._id, action, payload });
  };

  if (queueLoading) return <div className="p-8 text-center text-text-muted">Loading workspace...</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">My Execution Queue</div>
          <div className="section-sub">Direct management of high-value industry partner leads for {currentUser?.state}</div>
        </div>
        <div className="flex items-center gap-3">
          <Tag variant={isWorking ? 'green' : 'amber'} label={isWorking ? '● Work Active' : '⏸ Work Paused'} />
          <Button 
            className={isWorking ? 'bg-red text-white' : 'bg-purple text-white'}
            size="sm" 
            onClick={() => isWorking ? endWorkMutation.mutate() : startWorkMutation.mutate()}
            disabled={startWorkMutation.isLoading || endWorkMutation.isLoading}
          >
            {isWorking ? '⏹ End Work' : '▶ Resume Work'}
          </Button>
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Tasks Today</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{myLeads.length}</div>
          <div className="stat-delta">Direct state-level accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Efficiency</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{dashData?.attendance?.completionPct || 0}%</div>
          <div className="stat-delta">Work completion rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Calls This Week</div>
          <div className="stat-value" style={{ color: 'var(--teal)' }}>{dashData?.monthlyStats?.calls || 0}</div>
          <div className="stat-delta text-teal">Personal activity</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">My Conversions</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{dashData?.monthlyStats?.converted || 0}</div>
          <div className="stat-delta">Closed this month</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          {!isWorking ? (
            <div className="card flex flex-col items-center justify-center text-center p-12 min-h-[400px]">
              <div className="w-20 h-20 bg-surface2 rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-sm border border-border">🧑‍💼</div>
              <div className="text-xl font-bold mb-3">Ready to start?</div>
              <p className="text-sm text-text-muted mb-8 max-w-[320px] leading-relaxed">
                You have {myLeads.length} corporate leads waiting. Start your work session to begin.
              </p>
              <Button className="bg-purple text-white px-8" onClick={() => startWorkMutation.mutate()}>▶ Start Session Now</Button>
            </div>
          ) : isLastLead ? (
            <div className="card flex flex-col items-center justify-center text-center p-12 min-h-[400px]">
              <div className="w-20 h-20 bg-accent/20 text-accent rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-sm border border-accent/20">🎉</div>
              <div className="text-xl font-bold mb-3">All work done!</div>
              <p className="text-sm text-text-muted mb-8 max-w-[320px]">You've completed your personal queue for today.</p>
              <Button className="bg-accent text-white px-8" onClick={() => endWorkMutation.mutate()}>✓ End Today's Session</Button>
            </div>
          ) : (
            <div className="card">
              <div className="card-header border-b border-border bg-surface2/10">
                <div className="flex items-center gap-3">
                   <div className="text-lg">🎯</div>
                   <div className="section-title text-sm">Active Account</div>
                </div>
                <Tag variant={currentLead.priority === 'hot' ? 'red' : 'amber'} label={currentLead.status.toUpperCase()} />
              </div>
              <div className="card-body">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-xl font-bold tracking-tight">{currentLead.company}</div>
                    <div className="text-xs text-text-muted mt-1">Primary Contact: <span className="font-semibold">{currentLead.name}</span></div>
                    <div className="text-sm text-blue font-bold mt-2">{currentLead.phone}</div>
                  </div>
                  <Tag variant="gray" label={currentLead.leadId} />
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-surface2 p-3 rounded-xl border border-border">
                    <div className="text-[10px] font-bold text-text-muted uppercase">District</div>
                    <div className="text-sm font-bold mt-0.5">{currentLead.district}</div>
                  </div>
                  <div className="bg-surface2 p-3 rounded-xl border border-border">
                    <div className="text-[10px] font-bold text-text-muted uppercase">Status</div>
                    <div className="text-sm font-bold mt-0.5 capitalize">{currentLead.status}</div>
                  </div>
                  <div className="bg-surface2 p-3 rounded-xl border border-border">
                    <div className="text-[10px] font-bold text-text-muted uppercase">RNR</div>
                    <div className="text-sm font-bold mt-0.5">{currentLead.rnrCount}/3</div>
                  </div>
                </div>
                <div className="bg-purple-light/10 border border-purple/20 p-4 rounded-xl mb-8 text-[12px] leading-relaxed italic text-text-secondary">
                   <strong>📋 Manager Strategy:</strong> High-value corporate account. Focus on long-term partnership benefits.
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button className="bg-accent text-white flex-1" onClick={() => handleAction('call_done')}>✓ Call Completed</Button>
                  <Button variant="outline" className="text-amber border-amber/30" onClick={() => handleAction('rnr')}>📵 Mark RNR</Button>
                  <Button size="xs" variant="outline" onClick={() => setCurrentLeadIdx(prev => prev + 1)}>Skip</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="card">
            <div className="card-header border-b border-border bg-surface2/10">
              <div className="section-title text-sm">Personal Queue Progress</div>
            </div>
            <div className="divide-y divide-border max-h-[350px] overflow-y-auto">
              {myLeads.map((l, i) => {
                const active = i === currentLeadIdx && isWorking;
                const done = i < currentLeadIdx;
                return (
                  <div key={l._id} className={`flex items-center gap-4 p-4 ${active ? 'bg-purple-light/20 border-l-4 border-purple' : ''} transition-colors`}>
                    <div className={`w-2 h-2 rounded-full ${done ? 'bg-accent' : active ? 'bg-purple' : 'bg-border'}`}></div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold ${done ? 'text-text-muted line-through opacity-50' : ''}`}>{l.company}</div>
                      <div className="text-[10px] text-text-muted">{l.district} · {l.name}</div>
                    </div>
                    <Tag variant={done ? 'green' : active ? 'purple' : 'gray'} label={done ? 'DONE' : active ? 'ACTIVE' : 'LATER'} />
                  </div>
                );
              })}
              {myLeads.length === 0 && <div className="p-8 text-center text-text-muted text-xs italic">Queue empty</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header border-b border-border bg-surface2/10">
          <div>
            <div className="section-title text-sm">State-Level Accounts</div>
            <div className="section-sub">Corporate connections and industry partner allocations in {currentUser?.state}</div>
          </div>
          <Button className="bg-purple text-white" size="sm" onClick={() => openModal('new-lead')}>+ Add Corporate Lead</Button>
        </div>
        <DataTable 
          columns={[
            { header: 'Organisation', accessor: 'company', render: (val, row) => <div><div className="font-bold text-xs">{val}</div><div className="text-[10px] text-text-muted">{row.name}</div></div> },
            { header: 'District', accessor: 'district' },
            { header: 'Status', accessor: 'status', render: (val) => <Tag variant={val === 'hot' ? 'red' : 'amber'} label={val.toUpperCase()} /> },
            { header: 'RNR', accessor: 'rnrCount', render: (val) => <span className="mono text-xs font-bold">{val}x</span> },
            { header: 'Created', accessor: 'createdAt', render: (val) => <span className="text-[10px]">{new Date(val).toLocaleDateString()}</span> },
            { header: 'Action', accessor: '_id', render: (id, row, idx) => <Button size="xs" variant="outline" onClick={() => { setCurrentLeadIdx(idx); }}>Work</Button>, align: 'right' }
          ]}
          data={myLeads}
        />
      </div>
    </div>
  );
};

export default MyWork;
