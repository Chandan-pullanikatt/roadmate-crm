import React, { useEffect, useState } from 'react';
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
import LeadPipelinePanel, { LeadMetricsBreakdown } from '../../components/LeadPipelinePanel';
import KeyAchievements from '../../components/KeyAchievements';

const ExecutiveDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('performance');

  // Opening another profile from a tab re-uses this page, so start it on Performance.
  useEffect(() => { setActiveTab('performance'); }, [id]);

  const { data: detailData, isLoading, error } = useQuery({
    queryKey: ['executive', 'detail', id],
    queryFn: async () => {
      const [userRes, leadsRes, attendanceRes] = await Promise.all([
        api.get(`/stats/user/${id}`),
        api.get(`/leads?owner=${id}&limit=100`),
        api.get(`/attendance?userId=${id}&limit=30`)
      ]);
      const user = userRes.data?.user || {};
      // An Industry Manager's District Managers report directly to them.
      const districtManagers = user.role === 'industry_manager'
        ? (await api.get(`/users?role=executive&reportingTo=${id}`)).data || []
        : [];
      return {
        user,
        performance: userRes.data?.performance || { monthly: {}, totalLeads: 0, avgWorkPct: 0 },
        leads: leadsRes.data?.leads || [],
        attendance: attendanceRes.data || [],
        districtManagers
      };
    }
  });

  if (isLoading) return <DashboardSkeleton />;
  if (error) return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-bold text-red-500">Error loading executive details</h2>
      <p className="text-text-muted mt-2 text-sm">{error?.message || 'Please try again later.'}</p>
      <Button className="mt-4" onClick={() => navigate('/dashboard?page=executives')}>Back to List</Button>
    </div>
  );

  const { user = {}, performance = { monthly: {} }, leads = [], attendance = [], districtManagers = [] } = detailData || {};
  const isIndustryManager = user?.role === 'industry_manager';
  const roleLabel = isIndustryManager ? 'Industry Manager' : 'District Manager';

  const handleBack = () => {
    navigate(isIndustryManager ? '/dashboard?page=industry-managers' : '/dashboard?page=executives');
  };

  const safeFormat = (dateStr, fmt) => {
    try {
      if (!dateStr) return 'N/A';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'N/A';
      return format(d, fmt);
    } catch { return 'N/A'; }
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
            <span>{roleLabel}s</span>
            <span className="opacity-30">›</span>
            <span className="text-text-primary font-semibold">{user?.name || roleLabel}</span>
          </div>
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight">{roleLabel} Profile</h1>
        </div>
      </div>

      {/* SECTION 1: Profile Header */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-blue"></div>
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
          <Avatar name={user?.name || 'U'} size="xl" className="rounded-2xl border-4 border-surface2 shadow-md w-24 h-24 text-3xl" />
          
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h2 className="text-[28px] font-black text-text-primary tracking-tight">{user?.name || 'N/A'}</h2>
              <Tag variant="blue" label={roleLabel.toUpperCase()} className="font-black text-[10px] tracking-widest px-3" />
              <span className="bg-green/10 text-green px-3 py-1 rounded-full text-[12px] font-bold">{user?.isActive !== false ? 'Active' : 'Inactive'}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-y-2 gap-x-8 text-[14px] text-text-muted font-medium">
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">📧</span> {user?.email || 'N/A'}
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">📞</span> {user?.phone || 'N/A'}
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">📍</span> {[user?.district, user?.state].filter(Boolean).join(', ') || 'N/A'}
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">🏢</span> {user?.industry || 'General'} Vertical
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">🆔</span> {user?.employeeId || 'N/A'}
              </div>
              <div className="flex items-center gap-2">
                <span className="opacity-60 text-lg">📅</span> Joined {safeFormat(user?.dateOfJoining, 'PP')}
              </div>
            </div>
          </div>

          <div className="bg-surface2/50 p-4 rounded-xl border border-border min-w-[200px]">
            <div className="text-[11px] font-black text-text-muted uppercase tracking-wider mb-1">Current Salary</div>
            <div className="text-[24px] font-black text-text-primary">₹{user?.basicSalary?.toLocaleString() || 0}</div>
            <div className="text-[11px] text-text-muted font-medium mt-1">Per Month · Fixed</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 bg-surface2/30 p-1 rounded-xl border border-border w-fit">
        {[
          { id: 'performance', label: 'Performance' },
          // An Industry Manager's second tab lists the District Managers under them;
          // a District Manager's lists their leads.
          isIndustryManager
            ? { id: 'district-managers', label: 'District Managers' }
            : { id: 'leads', label: 'Leads' },
          { id: 'attendance', label: 'Attendance' },
          { id: 'documents', label: 'Documents' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-2 rounded-lg text-[13px] font-bold transition-all ${activeTab === tab.id ? 'bg-white shadow-sm text-blue' : 'text-text-muted hover:text-text-primary'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Sections */}
      {activeTab === 'performance' && (
        <div className="animate-in slide-in-from-bottom-2 duration-300">
          {/* SECTION 2: Performance Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            <LeadPipelinePanel ownerId={id} ownerName={user?.name} className="lg:col-span-3" />
            <StatCard label="Work Completion" value={`${performance?.avgWorkPct || 0}%`} sub="This Month" color="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <LeadMetricsBreakdown userId={id} />
            </div>

            <div className="flex flex-col gap-8">
              <KeyAchievements
                userId={id}
                achievements={user?.achievements || []}
                queryKey={['executive', 'detail', id]}
              />

              {isIndustryManager && (
                <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
                  <h3 className="text-[18px] font-bold mb-6 flex items-center gap-2">
                    <span className="text-amber">📋</span> Industry Overview
                  </h3>
                  <div className="space-y-4">
                    <OverviewItem label="District Managers" value={districtManagers.length} icon="📍" />
                    <OverviewItem label="Attendance Quality" value={`${performance?.attendancePct || 0}%`} icon="✅" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          {/* SECTION 3: Leads Table */}
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="p-4 pl-6 text-[11px] font-black uppercase text-text-muted tracking-widest">Lead / Company</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Status</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Priority</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Last Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map(lead => (
                <tr key={lead._id} className="hover:bg-surface2/30 transition-all">
                  <td className="p-4 pl-6">
                    <div className="font-bold text-[14px]">{lead.company || lead.name}</div>
                    <div className="text-[12px] text-text-muted">{lead.industry} · {lead.city}</div>
                  </td>
                  <td className="p-4">
                    <Tag 
                      variant={lead.status === 'converted' ? 'green' : lead.status === 'lost' ? 'red' : 'blue'} 
                      label={(lead.status || 'new').replace('_', ' ').toUpperCase()} 
                    />
                  </td>
                  <td className="p-4">
                    <span className={`text-[12px] font-bold ${lead.priority === 'hot' ? 'text-red-500' : lead.priority === 'warm' ? 'text-amber-500' : 'text-blue-500'}`}>
                      {(lead.priority || 'cold').toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-[13px] font-medium text-text-muted">
                    {safeFormat(lead.updatedAt, 'MMM dd, yyyy')}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-12 text-center text-text-muted italic">No leads assigned to this executive.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'district-managers' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="p-4 pl-6 text-[11px] font-black uppercase text-text-muted tracking-widest">Manager</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">District</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Status</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {districtManagers.map(dm => (
                <tr key={dm._id} className="hover:bg-surface2/30 transition-all cursor-pointer" onClick={() => navigate(`/dashboard/executives/${dm._id}`)}>
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar name={dm.name} size="sm" />
                      <div>
                        <div className="font-bold text-[14px]">{dm.name}</div>
                        <div className="text-[12px] text-text-muted">{dm.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {dm.district ? <Tag variant="blue" label={dm.district.toUpperCase()} /> : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="p-4">
                    {dm.isActive !== false
                      ? <span className="bg-green/10 text-green px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-green/20">Active</span>
                      : <span className="bg-red/10 text-red px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-red/20">Inactive</span>}
                  </td>
                  <td className="p-4 text-[13px] font-medium text-text-muted">
                    {safeFormat(dm.dateOfJoining, 'PP')}
                  </td>
                </tr>
              ))}
              {districtManagers.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-12 text-center text-text-muted italic">No District Managers report to this Industry Manager.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          {/* SECTION 4: Attendance Summary */}
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface2/50 border-b border-border">
                <th className="p-4 pl-6 text-[11px] font-black uppercase text-text-muted tracking-widest">Date</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Status</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Work %</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Started</th>
                <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {attendance.map(record => (
                <tr key={record._id} className="hover:bg-surface2/30 transition-all">
                  <td className="p-4 pl-6 font-bold text-[14px]">{safeFormat(record.date, 'EEE, MMM dd')}</td>
                  <td className="p-4">
                    <Tag 
                      variant={record.status === 'present' ? 'green' : record.status === 'half_day' ? 'amber' : 'red'} 
                      label={(record.status || 'absent').replace('_', ' ').toUpperCase()} 
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-surface2 rounded-full overflow-hidden">
                        <div className="h-full bg-blue" style={{ width: `${record.completionPct || 0}%` }}></div>
                      </div>
                      <span className="text-[12px] font-bold">{record.completionPct || 0}%</span>
                    </div>
                  </td>
                  <td className="p-4 text-[13px] font-medium text-text-muted">
                    {record.workStartedAt ? safeFormat(record.workStartedAt, 'hh:mm a') : '—'}
                  </td>
                  <td className="p-4 text-[13px] font-medium text-text-muted italic">
                    {record.note || 'No remarks'}
                  </td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-text-muted italic">No attendance records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 duration-300">
          {user.documents?.map((doc, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between group hover:border-blue transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface2 flex items-center justify-center text-xl">📄</div>
                <div>
                  <div className="text-[14px] font-bold truncate max-w-[150px]">{doc.name}</div>
                  <div className="text-[11px] text-text-muted">Uploaded {safeFormat(doc.uploadedAt, 'PP')}</div>
                </div>
              </div>
              <a 
                href={doc.url} 
                target="_blank" 
                rel="noreferrer"
                className="text-[12px] font-bold text-blue hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
              >
                View
              </a>
            </div>
          ))}
          {(!user.documents || user.documents.length === 0) && (
            <div className="col-span-full p-12 text-center text-text-muted italic bg-white rounded-2xl border border-border border-dashed">
              No documents uploaded for this executive.
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

const OverviewItem = ({ label, value, icon }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-surface2/30 border border-border/50">
    <div className="flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <span className="text-[13px] font-bold text-text-muted uppercase tracking-wider">{label}</span>
    </div>
    <span className="text-[16px] font-black text-text-primary">{value}</span>
  </div>
);

export default ExecutiveDetail;
