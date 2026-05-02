import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  StatCard,
  Button,
  Avatar,
  Tag,
  MemberRow,
  DashboardSkeleton
} from '../../../components/ui';
import { dashboardApi } from '../../../api/dashboardApi';
import { leaveApi } from '../../../api/leaveApi';
import { useAuth } from '../../../context/AuthContext';


const DistrictExecutives = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [activeDistrict, setActiveDistrict] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleRefresh = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'industry-manager'] });
    };
    window.addEventListener('refresh-users', handleRefresh);
    return () => window.removeEventListener('refresh-users', handleRefresh);
  }, [queryClient]);

  const openCreateExec = (editData = null) => {
    window.dispatchEvent(new CustomEvent('open-modal', {
      detail: {
        type: 'create-exec',
        role: 'executive',
        ...(editData ? { editData } : {
          prefill: {
            reportingTo: currentUser?._id,
            state: currentUser?.state,
            industry: currentUser?.industry
          }
        })
      }
    }));
  };

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  const executives = dashData?.executivePerformance || [];
  const stats = dashData?.stats || {};

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ['leaves', 'pending'],
    queryFn: () => leaveApi.getPendingLeaves().then(r => r.data || []),
    staleTime: 2 * 60 * 1000,
  });

  const pendingLeaveMap = useMemo(() => {
    const map = {};
    pendingLeaves.forEach(l => {
      const uid = l.user?._id || l.user;
      if (uid) map[String(uid)] = (map[String(uid)] || 0) + 1;
    });
    return map;
  }, [pendingLeaves]);

  // Extract unique districts - moved before conditional return
  const districts = useMemo(() => {
    return ['All', ...new Set(executives.map(e => e.district))];
  }, [executives]);

  const filteredExecs = useMemo(() => {
    let result = activeDistrict === 'All' ? executives : executives.filter(e => e.district === activeDistrict);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(e =>
        e.name?.toLowerCase().includes(q) ||
        e.district?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [executives, activeDistrict, searchTerm]);

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };



  if (isLoading && !dashData) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">District Executives</h1>
          <p className="text-sm text-text-muted">All district executives · {dashData?.user?.industry} · Performance</p>
        </div>
        <div className="flex items-center gap-3">
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
            onClick={() => openCreateExec()}
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
                      {(pendingLeaveMap[String(exec._id)] || 0) > 0 && (
                        <span className="px-2 py-0.5 bg-red/10 text-red rounded-full text-[10px] font-bold border border-red/20">
                          {pendingLeaveMap[String(exec._id)]} leave pending
                        </span>
                      )}
                      <Tag variant={exec.isWorking ? 'green' : 'surface2'} label={exec.status} />
                      <Button size="xs" variant="outline" className="rounded-lg h-8 px-4 font-bold border-border/60 hover:border-purple/40" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'assign-target', executive: exec } }))}>Set Target</Button>
                      <Button size="xs" variant="outline" className="rounded-lg h-8 px-4 font-bold border-border/60 hover:border-purple/40" onClick={() => openCreateExec(exec)}>Details</Button>
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
