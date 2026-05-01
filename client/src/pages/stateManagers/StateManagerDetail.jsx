import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import { 
  Avatar, 
  Button, 
  Tag, 
  DashboardSkeleton 
} from '../../components/ui';
import { format } from 'date-fns';

const StateManagerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('performance');

  const { data: detailData, isLoading, error } = useQuery({
    queryKey: ['state-manager', 'detail', id],
    queryFn: async () => {
      const [userRes, industryMgrsRes, leavesRes] = await Promise.all([
        api.get(`/stats/user/${id}`),
        api.get(`/users?role=industry_manager&reportingTo=${id}`),
        api.get(`/leave?userId=${id}`)
      ]);
      return {
        user: userRes.data.user,
        performance: userRes.data.performance,
        industryManagers: industryMgrsRes.data || [],
        leaves: leavesRes.data || []
      };
    }
  });

  if (isLoading) return <DashboardSkeleton />;
  if (error) return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-bold text-red-500">Error loading manager details</h2>
      <Button className="mt-4" onClick={() => navigate('/dashboard?page=state-managers')}>Back to List</Button>
    </div>
  );

  const { 
    user = {}, 
    performance = { monthly: {} }, 
    industryManagers = [], 
    leaves = [] 
  } = detailData || {};

  const handleBack = () => {
    navigate('/dashboard?page=state-managers');
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-[1400px] mx-auto p-4 md:p-8">
      {/* Breadcrumb & Back */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center hover:bg-surface2 transition-all shadow-sm"
        >
          <span className="text-lg">←</span>
        </button>
        <div>
          <div className="flex items-center gap-2 text-[12px] font-medium text-text-muted">
            <span>State Manager Management</span>
            <span className="opacity-30">›</span>
            <span className="text-text-primary font-semibold">{user.name}</span>
          </div>
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Manager Profile</h1>
        </div>
      </div>

      {/* SECTION 1: Profile Header */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-teal"></div>
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
          <Avatar name={user.name} size="xl" className="rounded-2xl border-4 border-surface2 shadow-md w-24 h-24 text-3xl" />
          
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h2 className="text-[28px] font-black text-text-primary tracking-tight">{user.name}</h2>
              <Tag variant="teal" label="STATE MANAGER" className="font-black text-[10px] tracking-widest px-3" />
              <span className="bg-green/10 text-green px-3 py-1 rounded-full text-[12px] font-bold">Active</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-2 gap-x-8 text-[14px] text-text-muted font-medium">
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">📧</span> {user.email}
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">📞</span> {user.phone}
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">📍</span> {user.state} (Full State)
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">🏢</span> Regional Head
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">🆔</span> {user.employeeId}
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">📅</span> Joined {user.dateOfJoining ? format(new Date(user.dateOfJoining), 'PP') : 'N/A'}
              </div>
            </div>
          </div>

          <div className="bg-surface2/50 p-4 rounded-xl border border-border min-w-[200px]">
            <div className="text-[11px] font-black text-text-muted uppercase tracking-wider mb-1">Monthly Salary</div>
            <div className="text-[24px] font-black text-text-primary">₹{user.basicSalary?.toLocaleString() || 0}</div>
            <div className="text-[11px] text-text-muted font-medium mt-1">Per Month · Regional Budget</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 bg-surface2/30 p-1 rounded-xl border border-border w-fit">
        {[
          { id: 'performance', label: 'Performance' },
          { id: 'industry-managers', label: 'Industry Managers' },
          { id: 'leaves', label: 'Leaves' },
          { id: 'documents', label: 'Documents' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === tab.id ? 'bg-white shadow-sm text-teal' : 'text-text-muted hover:text-text-primary'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Sections */}
      {activeTab === 'performance' && (
        <div className="animate-in slide-in-from-bottom-2 duration-300">
          {/* SECTION 2: Performance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard label="Regional Leads" value={performance.totalLeads} sub="Under Management" color="blue" />
            <StatCard label="Monthly Activity" value={performance.monthly.calls} sub="Calls & Meetings" color="purple" />
            <StatCard label="Regional Revenue" value={`₹${(performance.monthly.revenue >= 100000 ? (performance.monthly.revenue / 100000).toFixed(1) + 'L' : (performance.monthly.revenue / 1000).toFixed(1) + 'K')}`} sub="This Month" color="green" />
            <StatCard label="Work Completion" value={`${performance.avgWorkPct}%`} sub="Team Average" color="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-[18px] font-bold mb-6 flex items-center gap-2">
                <span className="text-teal">📊</span> Regional Metrics Breakdown
              </h3>
              <div className="space-y-6">
                <MetricBar label="Lead Conversions" value={performance.monthly.conversions} total={performance.monthly.calls} color="bg-green" />
                <MetricBar label="Meetings Done" value={performance.monthly.meetings} total={performance.monthly.calls} color="bg-blue" />
                <MetricBar label="Follow-ups" value={performance.monthly.followups} total={performance.monthly.calls} color="bg-purple" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-[18px] font-bold mb-6 flex items-center gap-2">
                <span className="text-amber">📋</span> State Overview
              </h3>
              <div className="space-y-4">
                <OverviewItem label="Subordinate Managers" value={industryManagers.length} icon="👥" />
                <OverviewItem label="Active Districts" value={user.district ? user.district.split(',').length : 'Full State'} icon="📍" />
                <OverviewItem label="Attendance Quality" value={`${performance.avgWorkPct}%`} icon="✅" />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'industry-managers' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="p-4 pl-6 text-[11px] font-black uppercase text-text-muted tracking-widest">Manager</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Industry</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Status</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {industryManagers.map(mgr => (
                <tr key={mgr._id} className="hover:bg-surface2/30 transition-all cursor-pointer" onClick={() => navigate(`/dashboard/executives/${mgr._id}`)}>
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar name={mgr.name} size="sm" />
                      <div>
                        <div className="font-bold text-[14px]">{mgr.name}</div>
                        <div className="text-[12px] text-text-muted">{mgr.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <Tag variant="blue" label={mgr.industry.toUpperCase()} />
                  </td>
                  <td className="p-4">
                    <span className="bg-green/10 text-green px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-green/20">Active</span>
                  </td>
                  <td className="p-4 text-[13px] font-medium text-text-muted">
                    {mgr.dateOfJoining ? format(new Date(mgr.dateOfJoining), 'PP') : '—'}
                  </td>
                </tr>
              ))}
              {industryManagers.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-12 text-center text-text-muted italic">No Industry Managers report to this State Manager.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="p-4 pl-6 text-[11px] font-black uppercase text-text-muted tracking-widest">Type</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Duration</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Status</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leaves.map(leave => (
                <tr key={leave._id} className="hover:bg-surface2/30 transition-all">
                  <td className="p-4 pl-6">
                    <div className="font-bold text-[14px] capitalize">{leave.type} Leave</div>
                    <div className="text-[11px] text-text-muted">{format(new Date(leave.requestedAt), 'PP')}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-[13px] font-bold text-text-primary">{format(new Date(leave.fromDate), 'MMM dd')} - {format(new Date(leave.toDate), 'MMM dd')}</div>
                    <div className="text-[11px] text-text-muted">{leave.days} Day(s)</div>
                  </td>
                  <td className="p-4">
                    <Tag 
                      variant={leave.status === 'approved' ? 'green' : leave.status === 'rejected' ? 'red' : 'amber'} 
                      label={leave.status.toUpperCase()} 
                    />
                  </td>
                  <td className="p-4 text-[12px] font-medium text-text-secondary max-w-xs truncate">
                    {leave.reason}
                  </td>
                </tr>
              ))}
              {leaves.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-12 text-center text-text-muted italic">No leave applications found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 duration-300">
          {user.documents?.map((doc, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between group hover:border-teal transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface2 flex items-center justify-center text-xl">📄</div>
                <div>
                  <div className="text-[14px] font-bold truncate max-w-[150px]">{doc.name}</div>
                  <div className="text-[11px] text-text-muted">Uploaded {format(new Date(doc.uploadedAt), 'PP')}</div>
                </div>
              </div>
              <a 
                href={doc.url} 
                target="_blank" 
                rel="noreferrer"
                className="text-[12px] font-bold text-teal hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
              >
                View
              </a>
            </div>
          ))}
          {(!user.documents || user.documents.length === 0) && (
            <div className="col-span-full p-12 text-center text-text-muted italic bg-white rounded-2xl border border-border border-dashed">
              No identity documents or agreements uploaded.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper Components
const StatCard = ({ label, value, sub, color }) => (
  <div className={`bg-white p-6 rounded-2xl border border-border shadow-sm relative overflow-hidden`}>
    <div className={`absolute top-0 left-0 w-1 h-full bg-${color}`}></div>
    <div className="text-text-muted font-bold text-[11px] uppercase tracking-wider mb-2">{label}</div>
    <div className="text-[32px] font-black text-text-primary mb-1">{value}</div>
    <div className="text-[12px] text-text-muted font-medium">{sub}</div>
  </div>
);

const MetricBar = ({ label, value, total, color }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[13px] font-bold text-text-primary">{label}</span>
        <span className="text-[12px] font-black text-text-muted">{value} / {total} ({pct}%)</span>
      </div>
      <div className="w-full h-2 bg-surface2 rounded-full overflow-hidden border border-border/50">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
};

const OverviewItem = ({ label, value, icon }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-surface2/30 border border-border/50">
    <div className="flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <span className="text-[13px] font-bold text-text-muted uppercase tracking-wider tracking-tighter">{label}</span>
    </div>
    <span className="text-[16px] font-black text-text-primary">{value}</span>
  </div>
);

export default StateManagerDetail;
