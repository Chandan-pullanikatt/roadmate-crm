import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { dashboardApi } from '../../../api/dashboardApi';
import { Button, Modal } from '../../../components/ui';
import { toast } from 'react-hot-toast';

const Reports = () => {
  // `${reportId}:${action}` while a request is in flight, so only the button that
  // was pressed shows a busy label.
  const [loading, setLoading] = useState(null);
  const [viewing, setViewing] = useState(null); // { card, rows }

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'state-manager'],
    queryFn: () => dashboardApi.getStateManagerDashboard().then(res => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error("No data available for this report");
      return;
    }
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => 
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(',')
    ).join('\n');
    
    const blob = new Blob([headers + "\n" + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success(`${filename} generated successfully`);
  };

  // One fetch-and-format pass, shared by the viewer and the CSV export, so what is
  // on screen is exactly what downloads.
  const fetchRows = async (type) => {
      const res = await dashboardApi.getReport(type, { limit: 5000 });
      const rawData = res.data?.data || res.data || [];

      let formatted = [];

      switch(type) {
        case 'leads':
          formatted = rawData.map(l => ({
            ID: l.leadId,
            Business: l.business || l.company,
            Contact: l.name,
            Status: l.status,
            Industry: l.industry,
            District: l.district,
            Owner: l.owner?.name || 'Unassigned',
            Created: new Date(l.createdAt).toLocaleDateString()
          }));
          break;
        case 'performance':
          formatted = rawData.map(p => ({
            Name: p.user?.name,
            Industry: p.user?.industry,
            Calls: p.calls || 0,
            Meetings: p.meetings || 0,
            Conversions: p.conversions || 0,
            Revenue: p.revenue || 0
          }));
          break;
        case 'revenue':
          formatted = rawData.map(r => ({
            Date: r._id,
            Revenue: r.totalRevenue,
            Transactions: r.count
          }));
          break;
        case 'attendance':
          formatted = rawData.map(a => ({
            Name: a.user?.name,
            Role: a.user?.role,
            Date: new Date(a.date).toLocaleDateString(),
            Status: a.status,
            WorkPct: `${a.workPercentage || 0}%`,
            Efficiency: `${a.completionPct || 0}%`
          }));
          break;
        case 'salary':
          formatted = rawData.map(s => ({
            Name: s.user?.name,
            Period: `${s.month}/${s.year}`,
            Base: s.baseSalary,
            Incentives: s.incentives,
            Net: s.netSalary
          }));
          break;
        case 'leaves':
          formatted = rawData.map(l => ({
            Name: l.user?.name,
            Type: l.type,
            From: new Date(l.fromDate).toLocaleDateString(),
            To: new Date(l.toDate).toLocaleDateString(),
            Days: l.days,
            Status: l.status
          }));
          break;
        default:
          formatted = rawData;
      }

      return formatted;
  };

  const handleView = async (card) => {
    try {
      setLoading(`${card.id}:view`);
      setViewing({ card, rows: await fetchRows(card.id) });
    } catch (err) {
      toast.error("Failed to load report");
    } finally {
      setLoading(null);
    }
  };

  const handleDownload = async (card) => {
    try {
      setLoading(`${card.id}:download`);
      downloadCSV(await fetchRows(card.id), `${card.id.toUpperCase()}_REPORT`);
    } catch (err) {
      toast.error("Failed to generate report");
    } finally {
      setLoading(null);
    }
  };

  const reportCards = [
    { id: 'leads', title: 'Lead Report', desc: 'All leads · Status · Conversion', icon: '📊' },
    { id: 'performance', title: 'Performance Report', desc: 'Staff · Industry · Revenue', icon: '📈' },
    { id: 'revenue', title: 'Revenue Report', desc: 'By industry · By district', icon: '💰' },
    { id: 'attendance', title: 'Attendance Report', desc: 'Daily · Monthly · Half days', icon: '📅' },
    { id: 'salary', title: 'Salary Report', desc: 'Basic · Leaves · Incentives', icon: '💼' },
    { id: 'leaves', title: 'Leave Report', desc: 'Leaves taken · Balance', icon: '📋' },
  ];

  const user = dashData?.user || {};

  if (!dashData) return <DashboardSkeleton />;

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="section-header mb-8">
        <div>
          <div className="section-title">Reports · {user.state}</div>
          <div className="section-sub text-[13px]">Lead, performance, revenue, attendance, salary</div>
        </div>
        <Button className="bg-blue text-white font-black px-6 shadow-lg shadow-blue/20 hover:shadow-blue/40 transition-all" onClick={() => toast.success("Compiling all data aggregates...")}>
          Export All
        </Button>
      </div>

      {/* REPORT GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {reportCards.map((r) => (
          <div
            key={r.id}
            className="card border-none shadow-xl bg-white/80 backdrop-blur-md hover:scale-[1.02] transition-all group"
          >
            <div className="card-body py-16 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-surface rounded-3xl flex items-center justify-center text-4xl mb-8 shadow-inner border border-border/50 group-hover:rotate-12 transition-transform">
                {r.icon}
              </div>
              <div className="font-black text-[17px] tracking-tight mb-2 group-hover:text-blue transition-colors">{r.title}</div>
              <div className="text-[15px] text-text-muted font-medium tracking-tight px-6">{r.desc}</div>
              
              <div className="mt-8 flex items-center gap-3">
                <button
                  className="px-5 py-2 rounded-xl border border-border text-text-primary font-bold text-xs hover:bg-surface2 transition-all disabled:opacity-50"
                  disabled={!!loading}
                  onClick={() => handleView(r)}
                >
                  {loading === `${r.id}:view` ? 'Loading...' : 'View'}
                </button>
                <button
                  className="px-5 py-2 rounded-xl bg-[#0f766e] text-white font-bold text-xs shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                  disabled={!!loading}
                  onClick={() => handleDownload(r)}
                >
                  {loading === `${r.id}:download` ? 'Preparing...' : 'Download CSV'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewing && (
        <Modal
          title={viewing.card.title}
          subtitle={`${viewing.rows.length} record${viewing.rows.length === 1 ? '' : 's'}`}
          onClose={() => setViewing(null)}
          className="max-w-6xl"
        >
          {viewing.rows.length === 0 ? (
            <div className="py-16 text-center text-[16px] text-text-muted">No records found for this report</div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  className="px-5 py-2 rounded-xl bg-[#0f766e] text-white font-bold text-xs shadow-sm hover:shadow-md transition-all"
                  onClick={() => downloadCSV(viewing.rows, `${viewing.card.id.toUpperCase()}_REPORT`)}
                >
                  Download CSV
                </button>
              </div>
              <div className="overflow-auto max-h-[60vh] border border-border rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-surface2 sticky top-0">
                    <tr>
                      {Object.keys(viewing.rows[0]).map(h => (
                        <th key={h} className="text-left px-4 py-3 font-bold text-text-secondary whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.rows.map((row, i) => (
                      <tr key={i} className="border-t border-border hover:bg-surface2/50">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-4 py-2.5 text-text-primary whitespace-nowrap">{val ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
};

export default Reports;

