import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, Button, Modal, Tag, Avatar } from '../../../components/ui';
import { leadsApi } from '../../../api/leadsApi';
import { usersApi } from '../../../api/usersApi';
import { useToast } from '../../../context/ToastContext';

const LeadManagement = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [isReallocateModalOpen, setIsReallocateModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [newOwner, setNewOwner] = useState('');

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads', 'im-list', filters],
    queryFn: () => leadsApi.getLeads(filters).then(res => res.data)
  });

  const { data: executivesData } = useQuery({
    queryKey: ['users', 'executives'],
    queryFn: () => usersApi.getUsers({ role: 'executive' }).then(res => res.data)
  });

  const reallocateMutation = useMutation({
    mutationFn: (data) => leadsApi.allocateLead(data.leadId, data.ownerId),
    onSuccess: () => {
      queryClient.invalidateQueries(['leads', 'im-list']);
      setIsReallocateModalOpen(false);
      setNewOwner('');
      addToast("Lead reallocated successfully", "success");
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Reallocation failed", "error");
    }
  });

  const bulkUploadMutation = useMutation({
    mutationFn: (leads) => leadsApi.bulkUpload(leads),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['leads', 'im-list']);
      addToast(`Successfully uploaded ${res.data.count} leads`, "success");
    }
  });

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      const leads = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const lead = {};
        headers.forEach((header, i) => { lead[header] = values[i]; });
        return lead;
      });
      bulkUploadMutation.mutate(leads);
    };
    reader.readAsText(file);
  };

  const columns = [
    { 
      header: 'Company / Name', 
      accessor: 'company',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="font-bold text-sm text-text-primary">{val}</span>
          <span className="text-[11px] text-text-muted">{row.name}</span>
        </div>
      )
    },
    { 
      header: 'Status', 
      accessor: 'status',
      render: (val) => {
        let variant = 'gray';
        if (val === 'hot') variant = 'red';
        if (val === 'warm') variant = 'amber';
        if (val === 'converted') variant = 'green';
        if (val === 'new') variant = 'blue';
        return <Tag variant={variant} className="uppercase text-[9px] font-black">{val}</Tag>
      }
    },
    { 
      header: 'Owner', 
      accessor: 'owner',
      render: (val) => val ? val.name : <span className="text-red font-bold underline">Unassigned</span>
    },
    {
      header: 'Performance',
      accessor: 'rnrCount',
      render: (val) => (
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${val >= 3 ? 'bg-red animate-pulse' : 'bg-green'}`}></div>
           <span className="text-[11px] font-mono">{val || 0}/3 RNR</span>
        </div>
      )
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (id, row) => (
        <div className="flex gap-2">
           <Button size="xs" variant="outline" onClick={() => {
             setSelectedLead(row);
             setIsReallocateModalOpen(true);
           }}>Reallocate</Button>
           <Button 
            size="xs" 
            variant="outline" 
            className="text-red border-red/30 hover:bg-red-light"
            onClick={() => {
              if (window.confirm("Escalate this lead to State Manager?")) {
                leadsApi.transitionLead(row._id, 'escalate').then(() => {
                  queryClient.invalidateQueries(['leads', 'im-list']);
                  addToast("Lead escalated to State Manager", "success");
                });
              }
            }}
          >Escalate</Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex justify-between items-center bg-surface border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-text-primary tracking-tight">Lead Management</h2>
          <p className="text-sm text-text-muted">Allocate, track, and reassign leads across your district team.</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="file" 
            id="bulk-upload" 
            className="hidden" 
            accept=".csv"
            onChange={handleBulkUpload}
          />
          <Button 
            variant="outline" 
            onClick={() => document.getElementById('bulk-upload').click()}
            className="border-dashed"
            disabled={bulkUploadMutation.isLoading}
          >
            {bulkUploadMutation.isLoading ? 'Uploading...' : '⬆ Bulk Upload (CSV)'}
          </Button>
          <Button className="bg-purple text-white hover:bg-purple/90">+ New Lead</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-2 flex items-center gap-2 px-4 shadow-sm">
           <span className="text-text-muted">🔍</span>
           <input 
             className="bg-transparent border-none outline-none text-sm w-full py-2"
             placeholder="Search company or name..."
             value={filters.search}
             onChange={e => setFilters({...filters, search: e.target.value})}
           />
        </div>
        <select 
          className="bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none shadow-sm cursor-pointer"
          value={filters.status}
          onChange={e => setFilters({...filters, status: e.target.value})}
        >
          <option value="">All Statuses</option>
          {['new', 'followup', 'rnr', 'meeting_scheduled', 'converted', 'lost'].map(s => (
            <option key={s} value={s}>{s.toUpperCase()}</option>
          ))}
        </select>
        <select 
          className="bg-surface border border-border rounded-xl px-4 py-3 text-sm outline-none shadow-sm cursor-pointer"
          value={filters.priority}
          onChange={e => setFilters({...filters, priority: e.target.value})}
        >
          <option value="">All Priorities</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>
        <div className="bg-purple/5 border border-purple/20 rounded-xl px-4 py-3 text-purple text-xs font-bold flex items-center justify-center">
          Industry Scope: Automobile
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-default">
        <DataTable 
          columns={columns} 
          data={leadsData?.leads || []} 
          loading={leadsLoading}
          emptyMessage="No leads found for these filters."
        />
      </div>

      {/* Reallocate Modal */}
      {isReallocateModalOpen && (
        <Modal
          onClose={() => setIsReallocateModalOpen(false)}
          title="Reallocate Lead Owner"
          subtitle={`Assign ${selectedLead?.company} to a new district executive.`}
        >
          <div className="space-y-4 pt-2">
             {selectedLead?.rnrCount >= 3 && (
               <div className="p-4 bg-red-light border border-red/20 rounded-xl mb-4">
                  <p className="text-[11px] text-red font-bold uppercase tracking-widest mb-1 items-center flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-red animate-ping"></span>
                    RNR Warning
                  </p>
                  <p className="text-xs text-red/80 font-medium leading-relaxed">
                    This lead has reached 3+ RNRs. Reallocating to a senior executive is recommended.
                  </p>
               </div>
             )}

              <div className="space-y-2">
                 <label className="text-[11px] font-bold text-text-secondary uppercase">Select New Executive</label>
                 <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                    {executivesData?.map(exec => (
                      <div 
                        key={exec._id}
                        onClick={() => setNewOwner(exec._id)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${newOwner === exec._id ? 'border-purple bg-purple/5 shadow-md' : 'border-border hover:border-purple/30'}`}
                      >
                        <div className="flex items-center gap-3">
                           <Avatar name={exec.name} size="sm" />
                           <div>
                             <p className="text-sm font-bold">{exec.name}</p>
                             <p className="text-[10px] text-text-muted">{exec.district}</p>
                           </div>
                        </div>
                        {newOwner === exec._id && <div className="w-5 h-5 rounded-full bg-purple text-white flex items-center justify-center text-[10px]">✓</div>}
                      </div>
                    ))}
                 </div>
              </div>

              <div className="pt-6 flex gap-3">
                 <Button variant="outline" className="flex-1" onClick={() => setIsReallocateModalOpen(false)}>Cancel</Button>
                 <Button 
                   className="flex-1 bg-purple text-white hover:bg-purple/90 shadow-lg shadow-purple/20 disabled:opacity-50 disabled:cursor-not-allowed" 
                   onClick={() => reallocateMutation.mutate({ leadId: selectedLead._id, ownerId: newOwner })}
                   disabled={!newOwner || reallocateMutation.isLoading}
                 >
                   {reallocateMutation.isLoading ? 'Reallocating...' : 'Confirm Reassignment'}
                 </Button>
              </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default LeadManagement;
