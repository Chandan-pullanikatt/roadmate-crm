import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  StatCard, 
  Button, 
  Avatar, 
  Tag, 
  MemberRow,
  PerformanceMeter
} from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import CreateExecutive from './CreateExecutive';

const MyTeam = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data)
  });

  if (showCreate) {
    return <CreateExecutive onCancel={() => setShowCreate(false)} onSuccess={() => setShowCreate(false)} />;
  }

  if (isLoading) return <div className="p-8 text-center text-text-muted">Loading team data...</div>;

  const executives = dashData?.executives || [];
  const filteredExecs = executives.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
  // Find top performer (highest completion or conversions)
  const topPerformer = [...executives].sort((a, b) => (b.conversionsTotal || 0) - (a.conversionsTotal || 0))[0];
  const mostMeetings = [...executives].sort((a, b) => (b.meetingsDone || 0) - (a.meetingsDone || 0))[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl">District Executives · {dashData?.user?.industry}</h2>
          <p className="section-sub">Team performance across your assigned districts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            const headers = ['Name', 'District', 'Efficiency', 'Calls', 'Conversions'];
            const rows = executives.map(e => [e.name, e.district, `${e.completionPct}%`, e.callsToday, e.conversionsTotal]);
            const csv = [headers, ...rows].map(e => e.join(",")).join("\n");
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'team-report.csv'; a.click();
          }}>Download Team Report</Button>
          <Button className="bg-purple text-white" onClick={() => setShowCreate(true)}>+ Create Executive</Button>
        </div>
      </div>

      {/* Top Performers Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-purple-light/20 border-purple/20">
          <div className="card-body p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple flex items-center justify-center text-white text-xl">🏆</div>
            <div>
              <div className="text-[10px] text-purple font-bold uppercase tracking-wider">Top Performer</div>
              <div className="text-base font-bold">{topPerformer?.name || 'N/A'}</div>
              <div className="text-xs text-text-muted">{topPerformer?.conversionsTotal || 0} Conversions · {topPerformer?.completionPct || 0}% Eff.</div>
            </div>
          </div>
        </div>
        <div className="card bg-teal-light/20 border-teal/20">
          <div className="card-body p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-teal flex items-center justify-center text-white text-xl">🚀</div>
            <div>
              <div className="text-[10px] text-teal font-bold uppercase tracking-wider">Most Meetings</div>
              <div className="text-base font-bold">{mostMeetings?.name || 'N/A'}</div>
              <div className="text-xs text-text-muted">{mostMeetings?.meetingsDone || 0} Meetings Completed</div>
            </div>
          </div>
        </div>
        <div className="card bg-blue-light/20 border-blue/20">
          <div className="card-body p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue flex items-center justify-center text-white text-xl">📞</div>
            <div>
              <div className="text-[10px] text-blue font-bold uppercase tracking-wider">Active Today</div>
              <div className="text-base font-bold">{executives.filter(e => e.isWorking).length} Executives</div>
              <div className="text-xs text-text-muted">Currently working in queue</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex justify-between border-b border-border">
          <h3 className="section-title">Staff-by-Staff Performance</h3>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Search staff..." 
              className="bg-surface2 border border-border rounded-lg px-3 py-1 text-xs outline-none focus:border-purple"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="p-0 overflow-x-auto">
          <div className="flex items-center gap-3 p-3 px-4 bg-surface2/50 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-border">
            <div className="w-10 shrink-0"></div>
            <div className="flex-1">Staff Member</div>
            <div className="flex items-center gap-4 shrink-0 mr-2">
              <div className="w-[32px] text-center">Calls</div>
              <div className="w-[32px] text-center">Mtng</div>
              <div className="w-[32px] text-center">Conv</div>
              <div className="w-[32px] text-center">Eff.</div>
            </div>
            <div className="w-24 text-right">Status</div>
          </div>
          
          {filteredExecs.map((exec, idx) => (
            <MemberRow 
              key={exec._id}
              name={exec.name}
              meta={`${exec.district} · ${exec.email}`}
              avatarClass={`av-${idx % 5}`}
              workPct={exec.completionPct || 0}
              status={exec.isWorking ? 'Active' : 'Offline'}
              metrics={[
                { label: 'CALLS', value: exec.callsToday || 0, colorClass: 'text-blue' },
                { label: 'MTNG', value: exec.meetingsDone || 0, colorClass: 'text-teal' },
                { label: 'CONV', value: exec.conversionsTotal || 0, colorClass: 'text-accent' },
                { label: 'EFF.', value: `${exec.completionPct || 0}%`, colorClass: 'text-purple' }
              ]}
              actions={
                <Button size="xs" variant="outline">View Full Report</Button>
              }
            />
          ))}
          {filteredExecs.length === 0 && <div className="p-8 text-center text-text-muted">No staff found</div>}
        </div>
      </div>
    </div>
  );
};

export default MyTeam;
