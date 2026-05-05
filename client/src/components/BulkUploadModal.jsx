import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Button, Tag } from './ui';
import { leadsApi } from '../api/leadsApi';
import { useToast } from '../context/ToastContext';

// Fix: Bulk Upload Template — added Lead ID for update support
const EXPECTED_HEADERS = ['Lead ID', 'Lead Name', 'Phone Number', 'Alternate Phone', 'Email', 'Company', 'State', 'District', 'Region', 'Industry', 'Lead Source', 'Assigned To', 'Current Status', 'Sub-Status', 'Follow-Up Date', 'Remarks', 'Expected Revenue', 'Created Date'];
const REQUIRED_HEADERS = ['Lead Name', 'Phone'];

const BulkUploadModal = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null); // { headers: [], rows: [] }
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setParsedData(null);
      setErrors([]);
    }
  }, [isOpen]);

  const bulkUploadMutation = useMutation({
    mutationFn: (data) => leadsApi.bulkUpload(data),
    onSuccess: (res) => {
      const imported = res.data?.imported ?? 0;
      const updated = res.data?.updated ?? 0;
      const skipped = res.data?.skipped ?? 0;
      const total = imported + updated;
      let msg = '';
      if (imported > 0 && updated > 0) msg = `${imported} leads created, ${updated} updated`;
      else if (imported > 0) msg = `Successfully imported ${imported} leads!`;
      else if (updated > 0) msg = `Successfully updated ${updated} leads!`;
      else msg = 'No leads processed';
      if (skipped > 0) msg += ` (${skipped} skipped)`;
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
          const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('name'));
          const phoneKey = Object.keys(row).find(k => k.toLowerCase().includes('phone'));
          const idKey = Object.keys(row).find(k => k.toLowerCase() === 'lead id' || k.toLowerCase() === 'id');
          const isUpdateRow = !!(idKey && row[idKey]?.trim());

          // Update rows (with a Lead ID) don't require Name/Phone — server will match by ID or phone
          if (!isUpdateRow && (!row[nameKey] || !row[phoneKey])) {
            rowErrors.push(`Row ${index + 1}: Missing Name or Phone (required for new leads)`);
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
    // Fix: Template — Lead ID is first column (leave blank for new leads, fill for updates)
    const sampleRow = ',John Doe,9876543210,9876543211,john@example.com,Acme Corp,Maharashtra,Mumbai,West,Technology,Referral,,New,,15/06/2026,Looking for CRM solution,500000,01/01/2026';
    const updateRow = '60d21b4967d0d8992e610c85,Jane Smith,9876543212,,,Acme Ltd,Kerala,Kochi,South,Finance,Referral,,Follow-up,,20/06/2026,Follow up required,300000,';
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + sampleRow + "\n" + updateRow;
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
    
    // Map CSV rows to API payload
    const payload = parsedData.rows.map(row => {
      // Helper to find key case-insensitively
      const getVal = (keyStr) => {
        const k = Object.keys(row).find(k => k.toLowerCase().includes(keyStr.toLowerCase()));
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

      // Include Lead ID for update flow; if present the backend upserts by ID or phone match
      const leadId = getVal('lead id') || getVal('id');
      const rawPhone = (getVal('phone number') || getVal('phone'))?.toString().replace(/\D/g, '');
      const revenueRaw = getVal('expected revenue') || getVal('lead value') || getVal('revenue');
      return {
        ...(leadId ? { _id: leadId } : {}),
        name: getVal('lead name') || getVal('name'),
        phone: rawPhone || undefined,
        alternatePhone: getVal('alternate'),
        email: getVal('email'),
        company: getVal('company'),
        state: getVal('state'),
        district: getVal('district') || getVal('district & place'),
        region: getVal('region'),
        industry: getVal('industry'),
        leadSource: getVal('lead source') || 'Bulk Upload',
        assignedTo: getVal('assigned to') || getVal('lead handing'),
        status: getVal('current status') || getVal('status') || getVal('messaged status'),
        subStatus: getVal('sub-status') || getVal('sub status'),
        followUpDate: parseDate(getVal('follow-up date') || getVal('next follow-up date') || getVal('follow up date')),
        remarks: getVal('remarks') || getVal('follow-up notes') || getVal('notes'),
        priority: getVal('priority level') || getVal('priority'),
        expectedRevenue: revenueRaw ? Number(revenueRaw) : 0,
        createdDate: parseDate(getVal('created date') || getVal('date')),
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
            Required columns: <span className="font-bold text-text-primary">Lead Name</span> and <span className="font-bold text-text-primary">Phone Number</span>. Missing either will skip that row.<br />
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

            <div className="p-4 bg-surface2/50 border border-border rounded-xl flex items-center justify-between mt-4">
              <div>
                <div className="text-xs font-bold text-text-primary">Allocation Settings</div>
                <div className="text-[11px] text-text-muted mt-0.5">Leads will be imported as Unallocated. You can bulk allocate them later.</div>
              </div>
              <Tag variant="gray" label="Unallocated" />
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
