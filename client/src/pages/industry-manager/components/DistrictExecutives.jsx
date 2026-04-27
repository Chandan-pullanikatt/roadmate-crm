import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  StatCard, 
  Button, 
  Avatar, 
  Tag, 
  MemberRow
} from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';


const DistrictExecutives = () => {
  const [activeDistrict, setActiveDistrict] = useState('All');

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data)
  });

  const executives = dashData?.executivePerformance || [];
  const stats = dashData?.stats || {};
  
  // Extract unique districts - moved before conditional return
  const districts = useMemo(() => {
    return ['All', ...new Set(executives.map(e => e.district))];
  }, [executives]);

  const filteredExecs = useMemo(() => {
    if (activeDistrict === 'All') return executives;
    return executives.filter(e => e.district === activeDistrict);
  }, [executives, activeDistrict]);

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };



  if (isLoading) return (
    <div className="p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple mx-auto mb-4"></div>
        <div className="text-text-muted font-medium">Loading premium executive metrics...</div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">District Executives</h1>
          <p className="text-sm text-text-muted">All district executives · {dashData?.user?.industry} · Performance</p>
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

      {/* Sub Header / Action Row */}
      <div className="bg-surface1 border border-border/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold">District Executives · {dashData?.user?.industry} · {dashData?.user?.state}</h2>
          <p className="text-xs text-text-muted">{stats.totalExecutives} executives - Performance & lead handling</p>
        </div>
        <Button 
            className="bg-purple text-white border-none rounded-xl px-6 h-10 font-bold shadow-lg shadow-purple/10"
            onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', role: 'executive' } }))}
        >
            + Create Executive
        </Button>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
            label="Total Executives" 
            value={stats.totalExecutives || 0} 
            delta="↑ All active"
            deltaType="up"
            colorClass="purple" 
        />
        <StatCard 
            label="Avg Work %" 
            value={`${stats.avgWorkPct || 0}%`} 
            delta={`↑ ${Math.abs(stats.avgWorkGrowth || 0)}%`}
            deltaLabel="vs last week"
            deltaType={stats.avgWorkGrowth >= 0 ? "up" : "down"}
            colorClass="green" 
        />
        <StatCard 
            label="On Leave Today" 
            value={stats.onLeaveToday || 0} 
            delta="Approved"
            deltaType="up"
            colorClass="amber" 
        />
        <StatCard 
            label="Below 30% Work" 
            value={stats.below30Work || 0} 
            delta={stats.below30Work === 0 ? "↑ All on track" : "Attention needed"}
            deltaType={stats.below30Work === 0 ? "up" : "down"}
            colorClass="red" 
        />
      </div>

      {/* Executive List Section */}
      <div className="card">
        <div className="card-header border-none pb-0">
          <h3 className="section-title text-base font-bold">All Executives · {dashData?.user?.industry}</h3>
          <div className="flex bg-surface2 p-1 rounded-lg">
            {districts.map(d => (
                <button 
                    key={d}
                    onClick={() => setActiveDistrict(d)}
                    className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${activeDistrict === d ? 'bg-white shadow-sm text-purple' : 'text-text-muted hover:text-text-primary'}`}
                >{d}</button>
            ))}
          </div>
        </div>
        
        <div className="p-0 overflow-x-auto mt-4">
          <div className="divide-y divide-border/30 min-w-[900px]">
            {filteredExecs.map((exec, idx) => (
              <MemberRow 
                key={exec._id}
                name={exec.name}
                meta={`${exec.district} · ${exec.leadsCount} leads · ${exec.followupsCount} follow-ups`}
                avatarClass={`av-${idx % 5}`}
                workPct={exec.completionPct || 0}
                status={exec.status}
                metrics={[
                  { label: 'Calls', value: exec.calls || 0, colorClass: 'text-blue' },
                  { label: 'Meetings', value: exec.meetings || 0, colorClass: 'text-teal' },
                  { label: 'Conv.', value: exec.converted || 0, colorClass: 'text-accent' },
                  { label: 'Revenue', value: formatCurrency(exec.revenue || 0), colorClass: 'text-purple' },
                  { label: 'RNR', value: exec.rnrCount || 0, colorClass: 'text-amber' }
                ]}
                actions={
                  <div className="flex items-center gap-2">
                      <Tag variant={exec.isWorking ? 'green' : 'surface2'} label={exec.status} />
                      <Button size="xs" variant="outline" className="rounded-lg h-8 px-4 font-bold border-border/60 hover:border-purple/40">Details</Button>
                  </div>
                }
              />
            ))}
            {filteredExecs.length === 0 && (
                <div className="p-16 text-center text-text-muted italic">No executives found in this district</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistrictExecutives;
