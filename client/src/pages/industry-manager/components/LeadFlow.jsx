import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TaskStep, 
  Tag, 
  Button,
  Avatar
} from '../../../components/ui';
import { leadsApi } from '../../../api/leadsApi';
import { usersApi } from '../../../api/usersApi';

const LeadFlow = () => {
  const [selectedExecId, setSelectedExecId] = useState('');

  const { data: executives } = useQuery({
    queryKey: ['users', 'executives-selection'],
    queryFn: () => usersApi.getUsers({ role: 'executive' }).then(res => res.data)
  });

  const { data: queueData, isLoading } = useQuery({
    queryKey: ['leads', 'queue', selectedExecId],
    queryFn: () => leadsApi.getQueue(selectedExecId).then(res => res.data),
    enabled: !!selectedExecId
  });

  const activeLead = queueData?.queue?.[0];
  const history = activeLead?.history || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl">Executive Work Monitoring</h2>
          <p className="section-sub">Real-time view of what your district executives are working on</p>
        </div>
        <div className="flex items-center gap-3 bg-surface border border-border p-2 rounded-xl">
          <span className="text-xs font-bold text-text-muted px-2 uppercase">Select Executive</span>
          <select 
            className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-purple min-w-[200px]"
            value={selectedExecId}
            onChange={(e) => setSelectedExecId(e.target.value)}
          >
            <option value="">Choose an executive...</option>
            {executives?.map(e => (
              <option key={e._id} value={e._id}>{e.name} ({e.district})</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedExecId ? (
        <div className="p-20 text-center border-2 border-dashed border-border rounded-3xl bg-surface2/30">
          <div className="text-4xl mb-4">👀</div>
          <h3 className="font-bold text-text-primary">Monitor Active Work</h3>
          <p className="text-sm text-text-muted max-w-xs mx-auto mt-2">Select an executive from the dropdown above to view their current lead queue and active task progress.</p>
        </div>
      ) : isLoading ? (
        <div className="p-20 text-center text-text-muted">Loading queue data...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {/* Active Lead Context */}
            <div className="card">
              <div className="card-header flex justify-between">
                <h3 className="section-title text-base">Active Lead · {activeLead?.leadId || 'N/A'}</h3>
                {activeLead && <Tag variant={activeLead.priority === 'hot' ? 'red' : 'amber'} label={activeLead.priority?.toUpperCase()} />}
              </div>
              <div className="card-body">
                {!activeLead ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-text-muted">No active lead in queue</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <h4 className="text-lg font-bold">{activeLead.company}</h4>
                      <p className="text-sm text-text-muted">Contact: {activeLead.name} · {activeLead.phone}</p>
                      <p className="text-sm text-text-muted">District: {activeLead.district} · Status: {activeLead.status.toUpperCase()}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                      <div><span className="text-text-muted">RNR Count:</span> <span className={`${activeLead.rnrCount >= 2 ? 'text-red font-bold' : 'text-amber'}`}>{activeLead.rnrCount}/3</span></div>
                      <div><span className="text-text-muted">Assigned:</span> <span className="font-medium">{new Date(activeLead.assignedAt).toLocaleDateString()}</span></div>
                    </div>

                    <div className="bg-purple-light/10 border border-purple/20 p-4 rounded-xl">
                      <p className="text-xs text-purple font-bold uppercase tracking-wider mb-2">Manager Oversight</p>
                      <p className="text-xs text-text-secondary leading-relaxed">This executive is currently processing this lead. You can see history and task steps in the right panel.</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* RNR Rules (Static Context) */}
            <div className="card">
              <div className="card-header">
                <h3 className="section-title text-base">Reallocation Logic</h3>
              </div>
              <div className="card-body">
                <div className="bg-surface2 border border-border rounded-xl p-4 space-y-3">
                  <div className="flex gap-3 text-xs">
                    <span className="shrink-0">📵</span>
                    <div><strong>3 RNRs:</strong> Lead will be auto-reallocated to a different executive to ensure fresh contact attempt.</div>
                  </div>
                  <div className="flex gap-3 text-xs border-t border-border/50 pt-3 text-purple font-semibold">
                    <span className="shrink-0">🔀</span>
                    <div><strong>Manual Reallocation:</strong> You can override owner at any time from the Lead Management tab.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Task Steps */}
            <div className="card">
              <div className="card-header">
                <h3 className="section-title text-base">Active Lead History</h3>
              </div>
              <div className="card-body space-y-3 max-h-[300px] overflow-y-auto">
                {history.map((h, idx) => (
                  <TaskStep 
                    key={idx}
                    step={idx + 1} 
                    status="done"
                    title={h.action.replace('_', ' ').toUpperCase()} 
                    subtitle={`${new Date(h.createdAt).toLocaleString()} · ${h.performedBy?.name || 'System'}`} 
                  />
                ))}
                {history.length === 0 && <p className="text-center py-8 text-text-muted text-xs italic">No history for this lead yet</p>}
              </div>
            </div>

            {/* Queue List */}
            <div className="card">
              <div className="card-header">
                <h3 className="section-title text-base">Current Queue</h3>
              </div>
              <div className="divide-y divide-border">
                {queueData?.queue?.map((q, idx) => (
                  <div key={idx} className="p-3 px-4 flex items-center justify-between hover:bg-surface2 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-accent animate-pulse' : 'bg-text-muted opacity-30'}`} />
                      <span className={`text-sm ${idx === 0 ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>{q.company}</span>
                    </div>
                    <Tag variant={idx === 0 ? 'purple' : 'gray'} label={idx === 0 ? 'ACTIVE' : 'NEXT'} />
                  </div>
                ))}
                {(!queueData?.queue || queueData.queue.length === 0) && (
                  <div className="p-12 text-center text-text-muted italic text-xs">Queue is empty</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadFlow;
