import React, { useMemo, useState, useRef } from 'react';
import Papa from 'papaparse';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Button, Tag } from './ui';
import { leadsApi } from '../api/leadsApi';
import { usersApi } from '../api/usersApi';
import { useToast } from '../context/ToastContext';

const EXPECTED_HEADERS = [
  'Lead ID', 'Date', 'Name', 'District & Place', 'Contact Information',
  'Lead Handing', 'Lead Source', 'Messaged Status', 'Status', 'Last Contact Date',
  'Remarks', 'Partnership Category', 'Industry', 'Next Follow-Up Date', 'Follow-Up Notes',
  'No. of Followups', 'Priority Level', 'Next Action', 'Lead Value', 'Outcome',
  'Blocking Date', 'Full Amount Received Date', 'Reason for Lost Leads'
];
const REQUIRED_HEADERS = ['Name', 'Contact Information'];

const BulkUploadModal = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null); // { headers: [], rows: [] }
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [assignmentTargetId, setAssignmentTargetId] = useState('');
  const [selectedStateManagerId, setSelectedStateManagerId] = useState('');
  const [selectedIndustryManagerId, setSelectedIndustryManagerId] = useState('');
  const [selectedExecutiveId, setSelectedExecutiveId] = useState('');
  const [assignableUsers, setAssignableUsers] = useState([]);
  const fileInputRef = useRef(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setParsedData(null);
      setErrors([]);
      setAssignmentTargetId('');
      setSelectedStateManagerId('');
      setSelectedIndustryManagerId('');
      setSelectedExecutiveId('');
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    usersApi.getUsers()
      .then((res) => {
        const users = res.data || [];
        setAssignableUsers(users.filter(u => ['state_manager', 'industry_manager', 'executive'].includes(u.role)));
      })
      .catch(() => setAssignableUsers([]));
  }, [isOpen]);

  const stateManagers = useMemo(
    () => assignableUsers.filter(u => u.role === 'state_manager'),
    [assignableUsers]
  );

  const industryManagerOptions = useMemo(
    () => assignableUsers.filter(u => u.role === 'industry_manager' && u.reportingTo === selectedStateManagerId),
    [assignableUsers, selectedStateManagerId]
  );

  const executiveOptions = useMemo(
    () => assignableUsers.filter(u => u.role === 'executive' && u.reportingTo === selectedIndustryManagerId),
    [assignableUsers, selectedIndustryManagerId]
  );

  React.useEffect(() => {
    setAssignmentTargetId(selectedExecutiveId || selectedIndustryManagerId || selectedStateManagerId || '');
  }, [selectedStateManagerId, selectedIndustryManagerId, selectedExecutiveId]);

  const bulkUploadMutation = useMutation({
    mutationFn: (data) => leadsApi.bulkUpload(data),
    onSuccess: (res) => {
      const imported = res.data?.imported ?? 0;
      const updated = res.data?.updated ?? 0;
      const skipped = res.data?.skipped ?? 0;
      const errors = res.data?.errors || [];
      const total = imported + updated;
      let msg = '';
      if (imported > 0 && updated > 0) msg = `${imported} leads created, ${updated} updated`;
      else if (imported > 0) msg = `Successfully imported ${imported} leads!`;
      else if (updated > 0) msg = `Successfully updated ${updated} leads!`;
      else msg = 'No leads processed';
      if (skipped > 0) {
        const topReason = errors[0]?.reason || 'validation error';
        msg += ` (${skipped} skipped — ${topReason}${errors.length > 1 ? ', and others' : ''})`;
      }
      addToast(msg, total > 0 ? 'success' : 'error');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err) => {
      addToast(err.response?.data?.message || 'Failed to upload leads', 'error');
    }
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setErrors(['Please upload a valid CSV file.']);
      return;
    }

    setFile(selectedFile);
    setErrors([]);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields;
        const missingRequired = REQUIRED_HEADERS.filter(h => !headers.find(fileHeader => fileHeader.toLowerCase().includes(h.toLowerCase())));
        
        if (missingRequired.length > 0) {
          setErrors([`Missing required columns: ${missingRequired.join(', ')}`]);
          setParsedData(null);
          return;
        }

        if (results.data.length === 0) {
          setErrors(['The CSV file is empty.']);
          setParsedData(null);
          return;
        }

        // Validate rows
        const validRows = [];
        const rowErrors = [];

        results.data.forEach((row, index) => {
          const nameKey = Object.keys(row).find(k => k.toLowerCase() === 'name' || k.toLowerCase() === 'lead name');
          const contactKey = Object.keys(row).find(k => k.toLowerCase().includes('contact'));
          const idKey = Object.keys(row).find(k => k.toLowerCase() === 'lead id' || k.toLowerCase() === 'id');
          const isUpdateRow = !!(idKey && row[idKey]?.trim());

          // Update rows (with a Lead ID) don't require Name/Contact — server will match by ID
          if (!isUpdateRow && (!row[nameKey] || !row[contactKey])) {
            rowErrors.push(`Row ${index + 1}: Missing Name or Contact Information (required for new leads)`);
          } else {
            validRows.push(row);
          }
        });

        if (rowErrors.length > 0) {
          setErrors(rowErrors.slice(0, 5).concat(rowErrors.length > 5 ? [`...and ${rowErrors.length - 5} more errors.`] : []));
        }

        setParsedData({ headers, rows: validRows });
      },
      error: (error) => {
        setErrors([`Error parsing CSV: ${error.message}`]);
      }
    });
  };

  const handleDownloadTemplate = () => {
    const headers = EXPECTED_HEADERS.join(',');
    // Lead ID blank = new lead; Lead ID filled = update existing lead
    const sampleRow = [
      '',                        // Lead ID (blank for new)
      '01/01/2026',              // Date
      'John Doe',                // Name
      'Ernakulam - Kakkanad',    // District & Place
      '9876543210',              // Contact Information
      'Rajesh Kumar',            // Lead Handing
      'Referral',                // Lead Source
      'Yes',                     // Messaged Status
      'New',                     // Status
      '',                        // Last Contact Date
      'Interested in partnership', // Remarks
      'Gold',                    // Partnership Category
      'Technology',              // Industry
      '15/06/2026',              // Next Follow-Up Date
      'Call back after Monday',  // Follow-Up Notes
      '0',                       // No. of Followups
      'Hot',                     // Priority Level
      'Schedule meeting',        // Next Action
      '500000',                  // Lead Value
      '',                        // Outcome
      '',                        // Blocking Date
      '',                        // Full Amount Received Date
      ''                         // Reason for Lost Leads
    ].join(',');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + sampleRow;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "lead_upload_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleProcessUpload = async () => {
    if (!parsedData || parsedData.rows.length === 0) return;
    
    setIsProcessing(true);
    const allocationTargetId = selectedExecutiveId || selectedIndustryManagerId || selectedStateManagerId || '';
    
    // Map CSV rows to API payload
    const payload = parsedData.rows.map(row => {
      // Helper to find key case-insensitively.
      // Prefer an EXACT header match before falling back to a substring match —
      // otherwise getVal('status') would wrongly grab "Messaged Status", which
      // silently dropped every imported lead's real Status (all became "new").
      const getVal = (keyStr) => {
        const target = keyStr.toLowerCase();
        const keys = Object.keys(row);
        const exact = keys.find(k => k.toLowerCase().trim() === target);
        const k = exact || keys.find(k => k.toLowerCase().includes(target));
        return k ? row[k]?.trim() : undefined;
      };

      // Parse DD/MM/YYYY date strings
      const parseDate = (str) => {
        if (!str) return undefined;
        const parts = str.split('/');
        if (parts.length === 3) {
          return new Date(parts[2], parts[1] - 1, parts[0]).toISOString();
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? undefined : d.toISOString();
      };

      const leadId = getVal('lead id') || getVal('id');
      // Contact Information column holds the primary phone number
      const rawPhone = (getVal('contact information') || getVal('phone number') || getVal('phone'))
        ?.toString().replace(/\D/g, '');
      const revenueRaw = getVal('lead value') || getVal('expected revenue') || getVal('revenue');

      // District & Place column may be "Ernakulam - Kakkanad" — split on ' - ' or ','
      const districtPlace = getVal('district & place') || getVal('district') || '';
      const [districtPart, placePart] = districtPlace.includes(' - ')
        ? districtPlace.split(' - ')
        : districtPlace.includes(',')
          ? districtPlace.split(',')
          : [districtPlace, ''];

      // Normalize status value
      const rawStatus = getVal('status') || getVal('current status') || '';
      const statusMap = {
        'new': 'new', 'called': 'called', 'follow-up': 'followup', 'followup': 'followup',
        'follow up': 'followup', 'rnr': 'rnr', 'meeting': 'meeting_direct',
        'meeting virtual': 'meeting_virtual', 'meeting direct': 'meeting_direct',
        'converted': 'converted', 'blocking amount received': 'blocking_amount_received',
        'full amount received': 'full_amount_received', 'agreement signed': 'agreement_signed',
        'lost': 'lost', 'not interested': 'not_interested', 'escalated': 'escalated',
        'nri - whatsapp messaged/connected': 'called', 'nri': 'called',
        'disconnected': 'rnr', 'disconnect': 'rnr',
        'decision pending - future': 'followup', 'decision pending': 'followup', 'pending': 'followup',
        'no budget': 'not_interested', 'budget issue': 'not_interested',
        'duplicate': 'lost', 'duplicates': 'lost', 'dup': 'lost',
        'business lead': 'new', 'business': 'new',
        'not intersted': 'not_interested', 'not intrested': 'not_interested',
        'call back later': 'followup', 'will call back': 'followup', 'cb': 'followup',
        'busy': 'rnr', 'not available': 'rnr', 'unreachable': 'rnr',
      };
      // Pass raw status through if not in map — server handles unknown statuses
      const normalizedStatus = statusMap[rawStatus.toLowerCase()] || rawStatus || undefined;

      // Normalize priority
      const rawPriority = (getVal('priority level') || getVal('priority') || '').toLowerCase();
      const normalizedPriority = rawPriority.includes('hot') ? 'hot'
        : rawPriority.includes('warm') ? 'warm'
        : rawPriority.includes('cold') ? 'cold'
        : 'cold';

      return {
        ...(leadId ? { _id: leadId } : {}),
        ...(allocationTargetId ? { ownerId: allocationTargetId } : {}),
        name: getVal('name') || getVal('lead name') || getVal('contact information') || 'Unknown',
        phone: rawPhone || undefined,
        district: districtPart?.trim() || undefined,
        region: placePart?.trim() || undefined,
        state: getVal('state') || undefined,
        industry: getVal('industry') || undefined,
        leadSource: getVal('lead source') || 'Bulk Upload',
        leadHandling: getVal('lead handing') || getVal('lead handling') || undefined,
        messagedStatus: getVal('messaged status') || undefined,
        status: normalizedStatus,
        lastContactDate: parseDate(getVal('last contact date')),
        remarks: getVal('remarks') || undefined,
        partnershipCategory: getVal('partnership category') || undefined,
        followUpDate: parseDate(getVal('next follow-up date') || getVal('follow-up date')),
        followUpNotes: getVal('follow-up notes') || getVal('followup notes') || undefined,
        followUpCount: Number(getVal('no. of followups') || getVal('no of followups') || 0),
        priority: normalizedPriority,
        nextAction: getVal('next action') || undefined,
        expectedRevenue: revenueRaw ? Number(revenueRaw) : 0,
        outcome: getVal('outcome') || undefined,
        blockingDate: parseDate(getVal('blocking date')),
        fullAmountReceivedDate: parseDate(getVal('full amount received date')),
        reasonForLost: getVal('reason for lost leads') || getVal('reason for lost') || undefined,
        createdDate: parseDate(getVal('date') || getVal('created date')),
      };
    });

    bulkUploadMutation.mutate(payload, {
      onSettled: () => setIsProcessing(false)
    });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      title="Bulk Lead Upload" 
      subtitle="Import leads from a CSV file"
      onClose={onClose}
      className="modal-lg"
    >
      <div className="space-y-6 py-2">
        {/* Info Banner */}
        <div className="p-4 bg-blue-light/30 border border-blue/20 rounded-2xl flex gap-3 items-start">
          <span className="text-blue text-lg">ℹ️</span>
          <div className="text-xs text-text-secondary leading-relaxed">
            Required columns: <span className="font-bold text-text-primary">Name</span> and <span className="font-bold text-text-primary">Contact Information</span>. Missing either will skip that row.<br />
            To <span className="font-bold text-text-primary">update an existing lead</span>, include its <span className="font-bold text-text-primary">Lead ID</span> in the first column — the row will be treated as an update instead of a new insert.<br />
            <button type="button" onClick={handleDownloadTemplate} className="text-blue font-bold hover:underline mt-1 bg-transparent border-none cursor-pointer p-0">Download CSV Template</button>
          </div>
        </div>

        {/* Upload Area */}
        {!parsedData && (
          <div className="w-full">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv"
              onChange={handleFileChange}
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-blue hover:bg-blue-light/20 rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-surface2 flex items-center justify-center text-2xl mb-2">
                📄
              </div>
              <div className="text-sm font-bold text-text-primary">Click to upload CSV file</div>
              <div className="text-xs text-text-muted">Maximum file size: 5MB</div>
            </div>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="p-4 bg-red-light border border-red/20 rounded-xl">
            <div className="text-xs font-bold text-red mb-2 uppercase tracking-wider">Errors Found</div>
            <ul className="list-disc pl-5 text-xs text-red/80 space-y-1">
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
            {parsedData && (
              <Button size="sm" variant="outline" className="mt-3 text-red border-red/20" onClick={() => { setParsedData(null); setFile(null); setErrors([]); }}>
                Upload Different File
              </Button>
            )}
          </div>
        )}

        {/* Preview Area */}
        {parsedData && parsedData.rows.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm font-bold text-text-primary">Previewing {parsedData.rows.length} valid leads</div>
                <div className="text-xs text-text-muted mt-1">File: {file?.name}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setParsedData(null); setFile(null); setErrors([]); }}>
                Change File
              </Button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface2/50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      {parsedData.headers.slice(0, 6).map((h, i) => (
                        <th key={i} className="px-4 py-3 font-bold text-text-muted uppercase tracking-wider border-b border-border whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                      {parsedData.headers.length > 6 && (
                        <th className="px-4 py-3 font-bold text-text-muted uppercase tracking-wider border-b border-border">...</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedData.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-surface2/20">
                        {parsedData.headers.slice(0, 6).map((h, j) => (
                          <td key={j} className="px-4 py-3 text-text-primary font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                            {row[h] || '-'}
                          </td>
                        ))}
                        {parsedData.headers.length > 6 && (
                          <td className="px-4 py-3 text-text-muted italic">...</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.rows.length > 5 && (
                <div className="px-4 py-2 bg-surface2/30 text-xs text-center text-text-muted border-t border-border font-medium">
                  Showing first 5 rows of {parsedData.rows.length} total rows
                </div>
              )}
            </div>

            <div className="p-4 bg-surface2/50 border border-border rounded-xl mt-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-text-primary">Allocation Settings</div>
                  <div className="text-[11px] text-text-muted mt-0.5">Optionally assign every lead in this upload to one manager or district executive.</div>
                </div>
                <Tag variant={assignmentTargetId ? 'green' : 'gray'} label={assignmentTargetId ? 'Will assign' : 'Unallocated'} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                <div>
                  <label className="form-label">State Manager</label>
                  <select
                    className="select"
                    value={selectedStateManagerId}
                    onChange={(e) => {
                      setSelectedStateManagerId(e.target.value);
                      setSelectedIndustryManagerId('');
                      setSelectedExecutiveId('');
                    }}
                  >
                    <option value="">Keep unallocated</option>
                    {stateManagers.map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({u.state || 'State Manager'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Industry Manager</label>
                  <select
                    className="select"
                    value={selectedIndustryManagerId}
                    disabled={!selectedStateManagerId}
                    onChange={(e) => {
                      setSelectedIndustryManagerId(e.target.value);
                      setSelectedExecutiveId('');
                    }}
                  >
                    <option value="">{selectedStateManagerId ? 'Assign to State Manager' : 'Select State Manager first'}</option>
                    {industryManagerOptions.map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({[u.industry, u.state].filter(Boolean).join(' · ') || 'Industry Manager'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">District Executive</label>
                  <select
                    className="select"
                    value={selectedExecutiveId}
                    disabled={!selectedIndustryManagerId}
                    onChange={(e) => setSelectedExecutiveId(e.target.value)}
                  >
                    <option value="">{selectedIndustryManagerId ? 'Assign to Industry Manager' : 'Select Industry Manager first'}</option>
                    {executiveOptions.map(u => (
                      <option key={u._id} value={u._id}>{u.name} ({[u.district, u.state].filter(Boolean).join(' · ') || 'Executive'})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t border-border mt-4">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>Cancel</Button>
          <Button 
            variant="primary" 
            onClick={handleProcessUpload} 
            disabled={!parsedData || parsedData.rows.length === 0 || isProcessing}
            className="bg-blue shadow-lg shadow-blue/20"
          >
            {isProcessing ? 'Processing...' : `Upload ${parsedData?.rows?.length || 0} Row${(parsedData?.rows?.length || 0) !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BulkUploadModal;
