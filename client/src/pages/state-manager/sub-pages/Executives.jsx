import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { Avatar, Button, Tag } from '../../../components/ui';

const Executives = () => {
  const [filterIndustry, setFilterIndustry] = useState('All');

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  if (dashLoading) return <DashboardSkeleton />;

  const stats = dashData?.stats || {};
  const user = dashData?.user || {};
  const executives = dashData?.executivePerformance || [];
  
  const filteredExecs = executives.filter(e => {
    return filterIndustry === 'All' || e.industry === filterIndustry;
  });

  const getIndustryColor = (industry) => {
    switch(industry) {
      case 'Automobile': return '#2563EB'; // Blue
      case 'Healthcare': return '#9333EA'; // Purple
      case 'FMCG': return '#10B981'; // Green
      case 'Electronics': return '#F59E0B'; // Amber
      case 'Textiles': return '#EA580C'; // Orange
      default: return '#6B7280';
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="section-header mb-6">
        <div>
          <div className="section-title">District Executives · {user.state}</div>
          <div className="section-sub text-[13px]">All executives across industries - Performance overview</div>
        </div>
        <Button className="bg-blue text-white shadow-sm" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', role: 'executive' } }))}>+ Add Executive</Button>
      </div>

      {/* STAT CARDS */}
      <div className="stat-grid mb-8">
        <div className="stat-card border-l-4 border-blue">
          <div className="stat-label">Total Executives</div>
          <div className="stat-value text-blue">{stats.districtExecutivesCount || 0}</div>
          <div className="stat-delta text-text-muted">Across 5 industries</div>
        </div>
        <div className="stat-card border-l-4 border-green">
          <div className="stat-label">Avg Work %</div>
          <div className="stat-value text-green">{stats.avgWorkPct || 0}%</div>
          <div className="stat-delta text-green font-bold">↑ 4% vs last week</div>
        </div>
        <div className="stat-card border-l-4 border-amber">
          <div className="stat-label">On Leave Today</div>
          <div className="stat-value text-amber">{stats.onLeaveToday || 0}</div>
          <div className="stat-delta text-amber font-medium">Leave approved</div>
        </div>
        <div className="stat-card border-l-4 border-red">
          <div className="stat-label">Below 30% Work</div>
          <div className="stat-value text-red">{stats.below30Work || 0}</div>
          <div className="stat-delta text-red font-bold">Marked as leave</div>
        </div>
      </div>

      {/* LIST SECTION */}
      <div className="card">
        <div className="card-header border-b border-border bg-surface2/5 flex justify-between items-center px-6 py-4">
          <div className="section-title text-[15px]">All Executives</div>
          <div className="flex bg-surface2 p-1 rounded-lg border border-border">
             {['All', 'Automobile', 'Healthcare', 'FMCG'].map(t => (
               <button 
                 key={t} 
                 className={`px-4 py-1 text-[11px] font-bold uppercase rounded-md transition-all ${filterIndustry === t ? 'bg-white shadow-sm text-blue' : 'text-text-muted hover:text-text'}`}
                 onClick={() => setFilterIndustry(t)}
               >
                 {t}
               </button>
             ))}
          </div>
        </div>
        <div className="card-body p-0">
          {filteredExecs.map((e, idx) => (
            <div key={e._id} className="flex items-center gap-6 p-5 border-b last:border-0 hover:bg-surface2 transition-all group">
              <Avatar name={e.name} size="lg" className={`av-${idx % 5}`} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1.5">
                   <div className="font-black text-[15px] tracking-tight">{e.name}</div>
                   <div className="text-[10px] font-black text-text-muted mono tracking-widest">{e.completionPct || 0}%</div>
                </div>
                <div className="text-[11px] text-text-muted mb-2 font-medium">{e.industry} · {e.district}</div>
                <div className="h-1.5 w-full bg-surface2 rounded-full overflow-hidden border border-border/50">
                  <div 
                    className="h-full transition-all duration-1000 shadow-sm" 
                    style={{ 
                        width: `${e.completionPct || 0}%`,
                        backgroundColor: getIndustryColor(e.industry)
                    }}
                  ></div>
                </div>
              </div>
              
              <div className="flex gap-10 mx-6">
                <div className="text-center">
                    <div className="text-[15px] font-black text-blue mono">{e.calls || 0}</div>
                    <div className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Calls</div>
                </div>
                <div className="text-center">
                    <div className="text-[15px] font-black text-green mono">{e.conversions || 0}</div>
                    <div className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Conv.</div>
                </div>
              </div>

              <div className="w-24 flex justify-end">
                <Tag 
                    variant={e.status === 'Active' ? 'green' : 'amber'} 
                    label={e.status.toUpperCase()} 
                    className="font-black text-[9px] tracking-widest"
                />
              </div>
            </div>
          ))}
          {filteredExecs.length === 0 && <div className="p-16 text-center text-text-muted italic">No executives found for the selected vertical.</div>}
        </div>
      </div>
    </div>
  );
};

export default Executives;

