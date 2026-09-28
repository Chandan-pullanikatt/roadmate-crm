import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal, Button, Tag } from './ui';
import { leadsApi } from '../api/leadsApi';
import { usersApi } from '../api/usersApi';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const EXPECTED_HEADERS = [
  'Lead ID', 'Date', 'Name', 'District & Place', 'Contact Information',
  'Lead Handing', 'Lead Source', 'Messaged Status', 'Status', 'Last Contact Date',
  'Remarks', 'Partnership Category', 'Industry', 'Next Follow-Up Date', 'Follow-Up Notes',
  'No. of Followups', 'Priority Level', 'Next Action', 'Lead Value', 'Outcome',
  'Blocking Date', 'Full Amount Received Date', 'Reason for Lost Leads'
];
const REQUIRED_HEADERS = ['Contact Information'];

const BulkUploadModal = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null); // { headers: [], rows: [] }
  const [errors, setErrors] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total }
  const [assignmentTargetId, setAssignmentTargetId] = useState('');
  const [selectedStateManagerId, setSelectedStateManagerId] = useState('');
  const [selectedIndustryManagerId, setSelectedIndustryManagerId] = useState('');
  const [selectedExecutiveId, setSelectedExecutiveId] = useState('');
  const [keepWithMe, setKeepWithMe] = useState(false);
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
      setKeepWithMe(false);
    }
  }, [isOpen]);

  // Fix: the allocation fields offer only the hierarchy BELOW the uploader, the same
  // rule the single/bulk Allocate form follows. A State Manager was being asked to
  // pick a State Manager -- herself, the only possible answer -- before she could
  // reach her own Industry Managers, and an Industry Manager had to walk two dead
  // steps to get to a District Manager. Now the Founder picks SM -> IM -> DM, a
  // State Manager picks IM -> DM, an Industry Manager picks a DM, and a District
  // Manager gets no allocation at all: they are the bottom of the tree, so the rows
  // they upload simply stay with them.
  const role = currentUser?.role;
  const isFounder = role === 'founder';
  const isStateManager = role === 'state_manager';
  const isIndustryManager = role === 'industry_manager';
  const canAllocate = isFounder || isStateManager || isIndustryManager;

  // Which steps this role is actually asked for.
  const showSmStep = isFounder;
  const showImStep = isFounder || isStateManager;
  const showDmStep = canAllocate;
  const stepCount = [showSmStep, showImStep, showDmStep].filter(Boolean).length;

  // A Founder or State Manager working leads personally has no entry in their own
  // allocation list -- the form only offers the levels below them -- so an upload
  // they meant to keep could only land unallocated. This is its own control rather
  // than an entry in the Industry Manager list, because keeping the leads is not
  // a choice of manager. An Industry Manager does not need it: the server already
  // defaults their uploads to themselves.
  const canKeepSelf = isFounder || isStateManager;
  const keepSelf = canKeepSelf && keepWithMe;

  // The branch of the tree the next dropdown reads from. For a manager it is
  // themselves -- their own level is implied, not chosen.
  const branchSmId = isFounder ? selectedStateManagerId : (isStateManager ? currentUser?._id : '');
  const branchImId = isIndustryManager ? currentUser?._id : selectedIndustryManagerId;

  // Each level is fetched by role + reportingTo, so the options come from the
  // reporting tree rather than from a state/industry match on the user record.
  const { data: stateManagers = [], isLoading: loadingSMs } = useQuery({
    queryKey: ['users', 'upload-sms'],
    queryFn: () => usersApi.getUsers({ role: 'state_manager' }).then(r => r.data || []),
    enabled: isOpen && showSmStep,
  });

  const { data: industryManagerOptions = [], isLoading: loadingIMs } = useQuery({
    queryKey: ['users', 'upload-ims', String(branchSmId || '')],
    queryFn: () => usersApi.getUsers({ role: 'industry_manager', reportingTo: branchSmId }).then(r => r.data || []),
    enabled: isOpen && showImStep && !!branchSmId,
  });

  const { data: executiveOptions = [], isLoading: loadingExecs } = useQuery({
    queryKey: ['users', 'upload-execs', String(branchImId || '')],
    queryFn: () => usersApi.getUsers({ role: 'executive', reportingTo: branchImId }).then(r => r.data || []),
    enabled: isOpen && showDmStep && !!branchImId,
  });

  React.useEffect(() => {
    setAssignmentTargetId(keepSelf
      ? currentUser?._id || ''
      : (selectedExecutiveId || selectedIndustryManagerId || selectedStateManagerId || ''));
  }, [selectedStateManagerId, selectedIndustryManagerId, selectedExecutiveId, keepSelf, currentUser?._id]);

  // Upload in chunks: large CSVs (300+ rows) overran the request/gateway timeout and showed
  // a bare "Failed" even though most rows were saved. Smaller batches finish quickly, survive
  // a single slow request, and let us report exactly what was imported/updated/skipped.
  const CHUNK_SIZE = 100;

  const bulkUploadMutation = useMutation({
    mutationFn: async (data) => {
      const chunks = [];
      for (let i = 0; i < data.length; i += CHUNK_SIZE) chunks.push(data.slice(i, i + CHUNK_SIZE));

      const agg = { total: data.length, imported: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
      setUploadProgress({ done: 0, total: data.length });

      for (let idx = 0; idx < chunks.length; idx++) {
        try {
          const res = await leadsApi.bulkUpload(chunks[idx]);
          const d = res.data || {};
          agg.imported += d.imported ?? 0;
          agg.updated += d.updated ?? 0;
          agg.skipped += d.skipped ?? 0;
          if (Array.isArray(d.errors)) agg.errors.push(...d.errors);
        } catch (e) {
          // One slow/failed batch no longer dooms the whole upload — keep going.
          agg.failed += chunks[idx].length;
          agg.errors.push({ row: `batch ${idx + 1}`, reason: e.response?.data?.message || e.message || 'request failed/timed out' });
        }
        setUploadProgress({ done: Math.min((idx + 1) * CHUNK_SIZE, data.length), total: data.length });
      }
      return agg;
    },
    onSuccess: (agg) => {
      const processed = agg.imported + agg.updated;
      let msg = '';
      if (agg.imported > 0 && agg.updated > 0) msg = `${agg.imported} leads created, ${agg.updated} updated`;
      else if (agg.imported > 0) msg = `Successfully imported ${agg.imported} leads!`;
      else if (agg.updated > 0) msg = `Successfully updated ${agg.updated} leads!`;
      else msg = 'No new leads processed';
      if (agg.skipped > 0) {
        const topReason = agg.errors.find(e => typeof e.row === 'number')?.reason || 'missing name/phone';
        msg += ` · ${agg.skipped} skipped (${topReason})`;
      }
      if (agg.failed > 0) {
        msg += ` · ${agg.failed} could not be sent — please re-upload just those rows`;
      }
      // Success unless literally nothing got through.
      addToast(msg, processed > 0 ? (agg.failed > 0 ? 'warning' : 'success') : 'error');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err) => {
      addToast(err.response?.data?.message || 'Failed to upload leads', 'error');
    },
    onSettled: () => setUploadProgress(null),
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
          const keys = Object.keys(row);
          // Match "Contact Information" / phone columns, but not "Last Contact Date"
          const contactKey = keys.find(k => k.toLowerCase().trim() === 'contact information')
            || keys.find(k => ['phone number', 'phone'].includes(k.toLowerCase().trim()));
          const idKey = keys.find(k => k.toLowerCase() === 'lead id' || k.toLowerCase() === 'id');
          const isUpdateRow = !!(idKey && row[idKey]?.trim());

          // Name is optional (the server falls back to the phone number). Only the
          // contact number is required, and update rows (with a Lead ID) don't need it.
          if (!isUpdateRow && !row[contactKey]?.trim()) {
            // +2: sheet row 1 is the header, and index is 0-based
            rowErrors.push(`Row ${index + 2}: Missing Contact Information (required for new leads)`);
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
      'Direct',                  // Lead Source
      'Yes',                     // Messaged Status
      'New',                     // Status
      '',                        // Last Contact Date
      'Interested in partnership', // Remarks
      'Gold',                    // Partnership Category
      'Grocery',                 // Industry
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
    const allocationTargetId = keepSelf
      ? (currentUser?._id || '')
      : (selectedExecutiveId || selectedIndustryManagerId || selectedStateManagerId || '');
    
    // Dates that could not be read at all. Collected across every row and shown
    // before the upload goes out, so a column the sheet formatted differently is
    // a visible warning instead of a quietly empty field.
    const dateErrors = [];
    // Status values the map did not recognise. Left unset rather than guessed, so
    // the server's own map gets a chance; anything it also misses becomes 'new'.
    const statusErrors = [];

    // Map CSV rows to API payload
    const payload = parsedData.rows.map((row, rowIndex) => {
      const rowNo = rowIndex + 2; // sheet row 1 is the header
      // Headers are matched on letters and digits only, so spacing, hyphens and
      // case cannot decide whether a column is found: "Next Follow-Up Date",
      // "Next Follow Up Date" and "FOLLOWUP DATE" are the same column. Matching on
      // the literal string is what silently dropped follow-up dates -- the template
      // ships the hyphenated spelling and anyone typing the header by hand does not.
      const squash = (v) => String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
      // A name prefixed with '=' matches only an exact header. Needed for a header
      // as short as "DATE", whose substring would otherwise swallow "Last Contact
      // Date" and "Next Follow-Up Date" on any sheet that has no DATE column.
      const getVal = (...names) => {
        const keys = Object.keys(row);
        for (const name of names) {
          const exactOnly = name.startsWith('=');
          const target = squash(exactOnly ? name.slice(1) : name);
          // Exact before substring, or getVal('status') grabs "Messaged Status"
          // and every imported lead's real status is lost.
          const k = keys.find(key => squash(key) === target)
            || (exactOnly ? undefined : keys.find(key => squash(key).includes(target)));
          const v = k == null ? undefined : row[k];
          if (v != null && String(v).trim() !== '') return String(v).trim();
        }
        return undefined;
      };

      // Day-first dates (15/06/2026), which is what the template asks for and what
      // every Indian sheet uses -- but the separator, the year length and the cell
      // format all vary, and each variant used to be dropped without a word:
      //   15-06-2026 / 15.06.2026  split('/') found one part -> Invalid Date
      //   15/06/26                 parsed as the year 26 -> 1926
      //   46188                    Excel serial, kept as the year 46188
      // Anything still unreadable is collected into dateErrors and shown, rather
      // than silently leaving the column empty.
      const parseDate = (str, label) => {
        if (str == null || String(str).trim() === '') return undefined;
        const raw = String(str).trim();

        const atLocalMidnight = (y, m, d) => {
          const dt = new Date(y, m, d);
          return isNaN(dt.getTime()) ? undefined : dt.toISOString();
        };

        // A cell formatted as a number: days since 1899-12-30, Excel's epoch.
        if (/^\d{4,5}(\.\d+)?$/.test(raw)) {
          const serial = Number(raw);
          if (serial > 20000 && serial < 80000) {
            const utc = new Date(Math.round((serial - 25569) * 86400000));
            return atLocalMidnight(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
          }
        }

        const parts = raw.match(/^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/);
        if (parts) {
          let [, a, b, c] = parts.map(Number);
          let y, mo, d;
          if (String(parts[1]).length === 4) {
            [y, mo, d] = [a, b, c];               // 2026-06-15
          } else {
            // Day first unless the first number cannot be a day or the second
            // cannot be a month, which is the only way to tell 6/15 from 15/6.
            const dayFirst = a > 12 || b <= 12;
            [d, mo] = dayFirst ? [a, b] : [b, a];
            y = c < 100 ? 2000 + c : c;
          }
          if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return atLocalMidnight(y, mo - 1, d);
        }

        const parsed = new Date(raw);              // "15 June 2026", "June 15, 2026"
        if (!isNaN(parsed.getTime())) {
          return atLocalMidnight(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        }

        dateErrors.push(`Row ${rowNo}: could not read ${label} "${raw}"`);
        return undefined;
      };

      const leadId = getVal('lead id', 'id');
      // Contact Information column holds the primary phone number
      const rawPhone = getVal('contact information', 'phone number', 'phone')
        ?.toString().replace(/\D/g, '');
      const revenueRaw = getVal('lead value', 'expected revenue', 'revenue');

      // District & Place column may be "Ernakulam - Kakkanad" — split on ' - ' or ','
      const districtPlace = getVal('district & place', 'district') || '';
      const [districtPart, placePart] = districtPlace.includes(' - ')
        ? districtPlace.split(' - ')
        : districtPlace.includes(',')
          ? districtPlace.split(',')
          : [districtPlace, ''];

      // Normalize status value
      const rawStatus = getVal('status', 'current status') || '';
      const statusMap = {
        'new': 'new', 'called': 'called', 'follow-up': 'followup', 'followup': 'followup',
        'rnr': 'rnr', 'not reached': 'rnr', 'switched off': 'rnr', 'switch off': 'rnr',
        'not reachable': 'rnr',
        'virtual meeting': 'meeting_virtual', 'meeting virtual': 'meeting_virtual',
        'direct meeting': 'meeting_direct', 'meeting direct': 'meeting_direct',
        'meeting': 'meeting_direct', 'meeting conducted': 'meeting_direct',
        'meeting scheduled': 'meeting_direct',
        'converted': 'converted', 'lost': 'lost',
        'not interested': 'not_interested', 'not intersted': 'not_interested',
        'escalated': 'escalated',
        'blocking amount received': 'blocking_amount_received',
        'blocking_amount_received': 'blocking_amount_received',
        'full amount received': 'full_amount_received',
        'full_amount_received': 'full_amount_received',
        'agreement signed': 'agreement_signed',
        'agreement_signed': 'agreement_signed',
        'call back': 'followup', 'callback': 'followup',
        'followup required': 'followup', 'followup require': 'followup',
        'interested': 'followup', 'intersted': 'followup',
        'connected': 'called', 'invalid': 'lost',
        'nri - whatsapp messaged/connected': 'called', 'nri': 'called',
        'disconnected': 'rnr', 'disconnect': 'rnr',
        'decision pending - future': 'followup', 'decision pending': 'followup', 'pending': 'followup',
        'no budget': 'not_interested', 'budget issue': 'not_interested',
        'duplicate': 'lost', 'duplicates': 'lost', 'dup': 'lost',
        'business lead': 'new', 'business': 'new',
        'not interested': 'not_interested', 'not intersted': 'not_interested', 'not intrested': 'not_interested',
        'call back later': 'followup', 'will call back': 'followup', 'cb': 'followup',
        'busy': 'rnr', 'not available': 'rnr', 'not reachable': 'rnr', 'unreachable': 'rnr',
        };
      // Matched on letters and digits only, for the same reason the headers are:
      // "Not Intersted", "not  intersted" and "NOT-INTERESTED" are one value, and a
      // stray double space or trailing punctuation in a cell must not decide whether
      // a lead is Not Interested or brand new.
      const statusByKey = Object.fromEntries(Object.entries(statusMap).map(([k, v]) => [squash(k), v]));
      const statusKey = squash(rawStatus);
      let normalizedStatus = statusByKey[statusKey];

      // Still nothing, and the cell said something: fall back to the longest known
      // value contained in it, so "Not Intersted (CB 4pm)" resolves rather than
      // silently becoming a new lead.
      if (!normalizedStatus && statusKey) {
        const hit = Object.keys(statusByKey)
          .filter(k => k.length > 3 && statusKey.includes(k))
          .sort((a, b) => b.length - a.length)[0];
        if (hit) normalizedStatus = statusByKey[hit];
      }

      // An unrecognised status used to pass through and the server turned it into
      // 'new' without a word -- which is how a sheet full of "Not Intersted" landed
      // as a queue full of fresh leads. Name it instead.
      if (!normalizedStatus && statusKey) {
        statusErrors.push(`Row ${rowNo}: unrecognised status "${rawStatus}"`);
      }
      // Send the raw text on when nothing matched. The server keeps the same map
      // and gets the final say -- dropping the value here made every status the
      // client happened to be missing fall through to the model default, 'new'.
      normalizedStatus = normalizedStatus || rawStatus || undefined;

      // Normalize priority
      const rawPriority = (getVal('priority level', 'priority') || '').toLowerCase();
      const normalizedPriority = rawPriority.includes('hot') ? 'hot'
        : rawPriority.includes('warm') ? 'warm'
        : rawPriority.includes('cold') ? 'cold'
        : 'cold';

      return {
        ...(leadId ? { _id: leadId } : {}),
        ...(allocationTargetId ? { ownerId: allocationTargetId } : {}),
        name: getVal('name', 'lead name', 'contact information') || 'Unknown',
        phone: rawPhone || undefined,
        district: districtPart?.trim() || undefined,
        region: placePart?.trim() || undefined,
        state: getVal('state') || undefined,
        industry: getVal('industry') || undefined,
        leadSource: getVal('lead source') || 'Bulk Upload',
        leadHandling: getVal('lead handing', 'lead handling') || undefined,
        messagedStatus: getVal('messaged status') || undefined,
        status: normalizedStatus,
        lastContactDate: parseDate(getVal('last contact date', 'last contacted'), 'Last Contact Date'),
        remarks: getVal('remarks', 'remark', 'comments', 'notes') || undefined,
        partnershipCategory: getVal('partnership category') || undefined,
        followUpDate: parseDate(
          getVal('next follow-up date', 'follow-up date', 'followup date', 'next followup', 'follow up'),
          'Next Follow-Up Date',
        ),
        followUpNotes: getVal('follow-up notes', 'followup notes') || undefined,
        followUpCount: Number(getVal('no. of followups', 'no of followups', 'followup count') || 0),
        priority: normalizedPriority,
        nextAction: getVal('next action') || undefined,
        expectedRevenue: revenueRaw ? Number(revenueRaw) : 0,
        outcome: getVal('outcome') || undefined,
        blockingDate: parseDate(getVal('blocking date'), 'Blocking Date'),
        fullAmountReceivedDate: parseDate(getVal('full amount received date'), 'Full Amount Received Date'),
        reasonForLost: getVal('reason for lost leads', 'reason for lost') || undefined,
        // The client's sheet heads this column just "DATE"; exact-only so it
        // cannot latch onto one of the other date columns.
        createdDate: parseDate(getVal('created date', '=date'), 'Created Date'),
      };
    });

    // The upload still goes ahead -- an unreadable date is one empty field, not a
    // reason to reject the sheet -- but it is named, because "the follow-up dates
    // did not save" was previously the only symptom.
    const problems = [];
    if (dateErrors.length) {
      problems.push(`${dateErrors.length} date${dateErrors.length === 1 ? '' : 's'} could not be read and were left empty:`,
        ...dateErrors.slice(0, 6),
        ...(dateErrors.length > 6 ? [`…and ${dateErrors.length - 6} more`] : []));
    }
    if (statusErrors.length) {
      const distinct = [...new Set(statusErrors.map(e => e.replace(/^Row \d+: /, '')))];
      problems.push(`${statusErrors.length} row${statusErrors.length === 1 ? '' : 's'} have a status this system does not know — they will import as New:`,
        ...distinct.slice(0, 6),
        ...(distinct.length > 6 ? [`…and ${distinct.length - 6} more kinds`] : []));
    }
    if (problems.length) setErrors(problems);

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
          <div className="text-[14px] text-text-secondary leading-relaxed">
            Required column: <span className="font-bold text-text-primary">Contact Information</span>. Rows without it are skipped. <span className="font-bold text-text-primary">Name</span> is optional — if blank, the phone number is used.<br />
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
              <div className="text-[14px] text-text-muted">Maximum file size: 5MB</div>
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
                <div className="text-[14px] text-text-muted mt-1">File: {file?.name}</div>
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
                <div className="px-4 py-2 bg-surface2/30 text-[14px] text-center text-text-muted border-t border-border font-medium">
                  Showing first 5 rows of {parsedData.rows.length} total rows
                </div>
              )}
            </div>

            {/* Allocation -- only the levels below the uploader (see the note above). */}
            {canAllocate ? (
              <div className="p-4 bg-surface2/50 border border-border rounded-xl mt-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-text-primary">Allocation Settings</div>
                    <div className="text-[13px] text-text-muted mt-0.5">
                      {isFounder
                        ? 'Assign every lead in this upload to one State Manager, Industry Manager or District Manager, or keep them yourself.'
                        : isStateManager
                          ? 'Assign every lead in this upload to an Industry Manager in your team, straight to one of their District Managers, or keep them yourself.'
                          : 'Optionally assign every lead in this upload to a District Manager in your team — otherwise they stay with you.'}
                    </div>
                  </div>
                  <Tag
                    variant={assignmentTargetId ? 'green' : 'gray'}
                    label={keepSelf ? 'Stays with you' : assignmentTargetId ? 'Will assign' : (isIndustryManager ? 'Stays with you' : 'Unallocated')}
                  />
                </div>
                {canKeepSelf && (
                  <label className="flex items-center gap-2.5 mt-4 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={keepWithMe}
                      onChange={(e) => {
                        setKeepWithMe(e.target.checked);
                        // Keeping the leads and handing them down are mutually
                        // exclusive, so a half-made choice cannot linger behind
                        // the disabled dropdowns.
                        if (e.target.checked) {
                          setSelectedStateManagerId('');
                          setSelectedIndustryManagerId('');
                          setSelectedExecutiveId('');
                        }
                      }}
                      className="w-4 h-4 accent-purple cursor-pointer"
                    />
                    <span className="text-[13px] font-bold text-text-primary">
                      Keep these leads with me ({currentUser?.name})
                    </span>
                  </label>
                )}
                <div className={`grid grid-cols-1 gap-3 mt-4 ${stepCount === 3 ? 'md:grid-cols-3' : stepCount === 2 ? 'md:grid-cols-2' : ''}`}>
                  {/* Step 1 -- State Manager (Founder only; a State Manager is their own branch) */}
                  {showSmStep && (
                    <div>
                      <label className="form-label">State Manager</label>
                      <select
                        className="select"
                        value={selectedStateManagerId}
                        disabled={keepSelf || loadingSMs}
                        onChange={(e) => {
                          setSelectedStateManagerId(e.target.value);
                          setSelectedIndustryManagerId('');
                          setSelectedExecutiveId('');
                        }}
                      >
                        <option value="">{loadingSMs ? 'Loading state managers…' : 'Keep unallocated'}</option>
                        {stateManagers.map(u => (
                          <option key={u._id} value={u._id}>{u.name} ({u.state || 'State Manager'})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Step 2 -- Industry Manager. First step for a State Manager, optional
                      for the Founder, who may stop at the SM. */}
                  {showImStep && (
                    <div>
                      <label className="form-label">Industry Manager</label>
                      <select
                        className="select"
                        value={selectedIndustryManagerId}
                        disabled={keepSelf || !branchSmId || loadingIMs}
                        onChange={(e) => {
                          setSelectedIndustryManagerId(e.target.value);
                          setSelectedExecutiveId('');
                        }}
                      >
                        <option value="">
                          {loadingIMs
                            ? 'Loading industry managers…'
                            : isStateManager
                              ? 'Keep unallocated'
                              : branchSmId ? 'Assign to State Manager' : 'Select State Manager first'}
                        </option>
                        {industryManagerOptions.map(u => (
                          <option key={u._id} value={u._id}>{u.name} ({[u.industry, u.state].filter(Boolean).join(' · ') || 'Industry Manager'})</option>
                        ))}
                      </select>
                      {isStateManager && !loadingIMs && industryManagerOptions.length === 0 && (
                        <p className="text-[11px] text-amber font-medium mt-1">No industry managers found in your team</p>
                      )}
                    </div>
                  )}

                  {/* Step 3 -- District Manager. The Industry Manager's only step. */}
                  {showDmStep && (
                    <div>
                      <label className="form-label">District Manager</label>
                      <select
                        className="select"
                        value={selectedExecutiveId}
                        disabled={keepSelf || !branchImId || loadingExecs}
                        onChange={(e) => setSelectedExecutiveId(e.target.value)}
                      >
                        <option value="">
                          {loadingExecs
                            ? 'Loading district managers…'
                            : isIndustryManager
                              ? 'Keep with me'
                              : branchImId ? 'Assign to Industry Manager' : 'Select Industry Manager first'}
                        </option>
                        {executiveOptions.map(u => (
                          <option key={u._id} value={u._id}>{u.name} ({[u.district, u.state].filter(Boolean).join(' · ') || 'District Manager'})</option>
                        ))}
                      </select>
                      {isIndustryManager && !loadingExecs && executiveOptions.length === 0 && (
                        <p className="text-[11px] text-amber font-medium mt-1">No district managers found in your team</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* A District Manager has nobody below them, so there is nothing to allocate to. */
              <div className="p-4 bg-surface2/50 border border-border rounded-xl mt-4 flex gap-3 items-start">
                <span className="text-blue text-lg">ℹ️</span>
                <div className="text-[14px] text-text-secondary leading-relaxed">
                  You are at the bottom of the reporting tree, so there is nobody to allocate to —
                  every lead in this upload stays in <span className="font-bold text-text-primary">your</span> list.
                </div>
              </div>
            )}
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
            {isProcessing
              ? (uploadProgress ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…` : 'Processing…')
              : `Upload ${parsedData?.rows?.length || 0} Row${(parsedData?.rows?.length || 0) !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BulkUploadModal;
