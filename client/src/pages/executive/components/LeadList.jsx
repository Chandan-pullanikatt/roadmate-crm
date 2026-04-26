import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../../../api/leadsApi';
import { Tag, Modal } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const LeadList = ({ onWorkLead }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', 'my-leads', activeFilter, searchTerm],
    queryFn: () => leadsApi.getLeads({
      status: activeFilter !== 'all' ? activeFilter : undefined,
      search: searchTerm || undefined,
      limit: 100 // Get more for the executive's list
    }).then(res => res.data)
  });

  const leads = leadsData?.leads || [];

  const escalateMutation = useMutation({
    mutationFn: (data) => leadsApi.transitionLead(data.leadId, 'escalate', { notes: data.notes }),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'my-leads']);
      addToast("Lead escalated to manager", "success");
    }
  });

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'new', label: '🆕 New' },
    { id: 'followup', label: '🔄 Follow-up' },
    { id: 'rnr', label: '📞 RNR' },
    { id: 'meeting_scheduled', label: '🎥 Meeting' },
    { id: 'converted', label: '✅ Converted' },
    { id: 'lost', label: '❌ Lost' },
  ];

  const exportLeads = () => {
    if (leads.length === 0) return;
    const headers = ['Name', 'Company', 'Phone', 'Status', 'Last Action'];
    const rows = leads.map(l => [l.name, l.company, l.phone, l.status, l.lastCallDate || 'Never']);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-leads-${new Date().toLocaleDateString()}.csv`;
    a.click();
    addToast("Exporting leads as CSV", "success");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="section-header">
        <div>
          <div className="section-title">My Leads</div>
          <div className="section-sub">All your assigned leads · View only your mapped leads</div>
        </div>
        <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
          <button className="btn btn-outline btn-sm" onClick={exportLeads}>Export</button>
          <button className="btn btn-orange btn-sm" onClick={() => onWorkLead()}>▶ Continue Work</button>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap'}}>
        {filters.map(f => (
          <button 
            key={f.id}
            className={`btn btn-sm ${activeFilter === f.id ? 'btn-orange-light' : 'btn-outline'}`}
            style={activeFilter === f.id ? {background: 'var(--orange-light)', color: 'var(--orange)', borderColor: '#FED7AA'} : {}}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card full-col">
        <div className="card-header">
          <div className="section-title" style={{fontSize: '13px'}}>Lead List — My Mapped Leads Only</div>
          <input 
            className="form-input" 
            type="text" 
            placeholder="Search…" 
            style={{width: '180px', padding: '5px 10px', fontSize: '12px'}}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lead Name</th>
                <th>Company</th>
                <th className="hide-mobile">Phone</th>
                <th>Status</th>
                <th className="hide-mobile">Last Action</th>
                <th className="hide-mobile">Next Follow-up</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="7" className="text-center py-8 text-text-muted">Loading leads...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-8 text-text-muted">No leads found.</td></tr>
              ) : leads.map(lead => (
                <tr key={lead._id}>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-bold">{lead.name}</span>
                      <span className="text-[10px] text-text-muted uppercase">{lead.industry}</span>
                    </div>
                  </td>
                  <td>{lead.company}</td>
                  <td className="hide-mobile">{lead.phone}</td>
                  <td>
                    <Tag 
                      label={lead.status.toUpperCase()} 
                      variant={lead.status === 'converted' ? 'green' : (lead.status === 'lost' ? 'red' : 'amber')} 
                    />
                  </td>
                  <td className="hide-mobile text-xs text-text-secondary">
                    {lead.lastCallDate ? new Date(lead.lastCallDate).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="hide-mobile">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">{lead.nextActionAt ? new Date(lead.nextActionAt).toLocaleDateString() : '-'}</span>
                      <span className="text-[10px] text-text-muted">{lead.nextActionAt ? new Date(lead.nextActionAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-orange btn-xs" onClick={() => onWorkLead(lead)}>Work</button>
                      <button 
                        className="btn btn-outline btn-xs" 
                        style={{color: 'var(--purple)', borderColor: 'var(--purple)'}} 
                        onClick={() => {
                          if (window.confirm("Escalate this lead to manager?")) {
                            escalateMutation.mutate({ leadId: lead._id, notes: 'Escalated from lead list' });
                          }
                        }}
                      >Escalate</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeadList;
