import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';

const Executives = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('All');

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data)
  });

  const { data: executives, isLoading: execsLoading } = useQuery({
    queryKey: ['users', 'executives-state'],
    queryFn: () => usersApi.getUsers({ role: 'executive' }).then(res => res.data)
  });

  if (dashLoading || execsLoading) return <div className="p-8 text-center text-text-muted">Loading executive data...</div>;

  const stats = dashData?.stats || {};
  
  const filteredExecs = executives?.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         e.district.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIndustry = filterIndustry === 'All' || e.industry === filterIndustry;
    return matchesSearch && matchesIndustry;
  });

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">District Executives</div>
          <div className="section-sub">Field team performance and activity tracking across {dashData?.user?.state}</div>
        </div>
        <div className="flex gap-2">
           <input 
             type="text" 
             placeholder="Search by name or district..." 
             className="bg-surface border border-border rounded-lg px-4 py-1.5 text-xs outline-none focus:border-purple w-64"
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
           />
           <select 
             className="bg-surface border border-border rounded-lg px-4 py-1.5 text-xs outline-none focus:border-purple"
             value={filterIndustry}
             onChange={e => setFilterIndustry(e.target.value)}
           >
             <option value="All">All Industries</option>
             <option value="Automobile">Automobile</option>
             <option value="Healthcare">Healthcare</option>
             <option value="FMCG">FMCG</option>
             <option value="Electronics">Electronics</option>
           </select>
        </div>
      </div>

      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Executives</div>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{executives?.length || 0}</div>
          <div className="stat-delta">Across all districts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Efficiency</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.attendancePct || 0}%</div>
          <div className="stat-delta text-accent">↑ Team work completion</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">On Leave Today</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{stats.onLeaveToday || 0}</div>
          <div className="stat-delta">Approved leaves</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Leads Assigned</div>
          <div className="stat-value" style={{ color: 'var(--teal)' }}>{stats.activeLeads || 0}</div>
          <div className="stat-delta">Pipeline items</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header border-b border-border">
          <div className="section-title">Field Performance Leaderboard</div>
        </div>
        <div className="card-body p-0">
          {filteredExecs?.map((e, idx) => (
            <div key={e._id} className="flex items-center gap-5 p-5 border-b last:border-0 hover:bg-surface2 transition-colors cursor-pointer">
              <Avatar name={e.name} size="lg" className={`av-${idx % 5}`} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                   <div className="font-bold text-[14.5px]">{e.name}</div>
                   <div className="text-[11px] font-bold mono" style={{ color: (e.completionPct || 0) >= 80 ? 'var(--accent)' : 'var(--amber)' }}>{e.completionPct || 0}%</div>
                </div>
                <div className="text-[12px] text-text-muted mb-2">{e.industry} · {e.district}</div>
                <div className="h-1.5 w-full max-w-[300px] bg-surface2 rounded-full overflow-hidden border border-border">
                  <div 
                    className="h-full transition-all duration-1000" 
                    style={{ 
                      width: `${e.completionPct || 0}%`, 
                      background: (e.completionPct || 0) >= 80 ? 'var(--accent)' : (e.completionPct || 0) >= 50 ? 'var(--amber)' : 'var(--red)' 
                    }}
                  ></div>
                </div>
              </div>
              <div className="flex gap-10 mx-10">
                <div className="text-center"><div className="text-[15px] font-bold text-blue mono">{e.callsToday || 0}</div><div className="text-[9px] text-text-muted uppercase font-bold">Calls</div></div>
                <div className="text-center"><div className="text-[15px] font-bold text-accent mono">{e.conversionsTotal || 0}</div><div className="text-[9px] text-text-muted uppercase font-bold">Conv</div></div>
              </div>
              <div className="flex items-center gap-3">
                <Tag variant={(e.attendanceStatus || 'active') === 'active' ? 'green' : 'amber'} label={e.attendanceStatus || 'active'} />
                <Button size="xs" variant="outline">View Log</Button>
              </div>
            </div>
          ))}
          {filteredExecs?.length === 0 && (
            <div className="p-12 text-center text-text-muted italic">No executives match your search filters</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Executives;
