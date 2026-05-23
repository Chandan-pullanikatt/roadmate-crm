import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sopApi } from '../../../api/sopApi';
import { uploadApi } from '../../../api/uploadApi';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/ui';

const ROLES = [
  {
    role: 'industry_manager',
    label: 'Industry Manager SOP',
    description: 'How Industry Managers should work — visible to all Industry Managers.',
    icon: '🏭',
    accent: 'teal',
    accentClass: 'border-[#0f766e] text-[#0f766e] bg-[#0f766e]/5',
    badgeClass: 'bg-[#0f766e]/10 text-[#0f766e] border-[#0f766e]/20',
  },
  {
    role: 'executive',
    label: 'District Executive SOP',
    description: 'How District Executives should work — visible to all DEs and their managers.',
    icon: '🗺️',
    accent: 'blue',
    accentClass: 'border-blue text-blue bg-blue/5',
    badgeClass: 'bg-blue/10 text-blue border-blue/20',
  },
];

const ALLOWED_TYPES = {
  'application/pdf':     'pdf',
  'application/msword':  'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain':          'txt',
};

const SopCard = ({ config, currentSop, onUploadSuccess }) => {
  const { addToast } = useToast();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileType = ALLOWED_TYPES[file.type];
    if (!fileType) {
      addToast('Only PDF, Word (.doc/.docx) and plain text files are allowed.', 'error');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // 1. Get presigned upload URL from R2
      const { data: presignData } = await uploadApi.getPresignedUpload({
        folder: 'sop',
        fileName: file.name,
        contentType: file.type,
        entityId: config.role,
      });

      // 2. Upload directly to R2
      await uploadApi.uploadFileDirect(presignData.uploadUrl, file, (pct) => setProgress(pct));

      // 3. Save SOP record in DB
      await sopApi.saveSop({
        role: config.role,
        fileKey: presignData.fileKey,
        fileName: file.name,
        fileType,
      });

      addToast(`${config.label} uploaded successfully.`, 'success');
      onUploadSuccess();
    } catch (err) {
      addToast(err?.response?.data?.message || 'Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`card p-0 overflow-hidden border-2 ${config.accentClass} shadow-sm hover:shadow-md transition-shadow`}>
      {/* Card Header */}
      <div className="px-8 pt-7 pb-5 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-3xl">{config.icon}</span>
          <div>
            <div className="text-base font-black text-text-primary">{config.label}</div>
            <div className="text-[11px] font-bold text-text-muted mt-0.5">{config.description}</div>
          </div>
        </div>
        {currentSop && (
          <span className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider ${config.badgeClass}`}>
            Uploaded
          </span>
        )}
        {!currentSop && (
          <span className="px-3 py-1.5 rounded-xl border border-amber/30 bg-amber/10 text-amber text-[10px] font-black uppercase tracking-wider">
            Not Uploaded
          </span>
        )}
      </div>

      {/* Current file info */}
      <div className="px-8 py-5">
        {currentSop ? (
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface2 border border-border/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface3 border border-border/40 flex items-center justify-center text-[11px] font-black uppercase text-text-muted">
                {currentSop.fileType}
              </div>
              <div>
                <div className="text-sm font-black text-text-primary">{currentSop.fileName}</div>
                <div className="text-[10px] font-bold text-text-muted mt-0.5">
                  Last updated {formatDate(currentSop.updatedAt)}
                  {currentSop.uploadedBy?.name && ` · by ${currentSop.uploadedBy.name}`}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-surface2 border border-dashed border-border/60 text-center text-[11px] font-bold text-text-muted">
            No SOP uploaded yet for this role.
          </div>
        )}

        {/* Upload area */}
        <div className="mt-5">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
            id={`sop-upload-${config.role}`}
          />
          <label
            htmlFor={`sop-upload-${config.role}`}
            className={`flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all text-[11px] font-black uppercase tracking-wider
              ${uploading
                ? 'border-border/40 text-text-muted cursor-not-allowed opacity-60'
                : `border-current ${config.accentClass} hover:opacity-80`
              }`}
          >
            {uploading ? (
              <>
                <span className="animate-spin text-base">⟳</span>
                Uploading… {progress > 0 ? `${progress}%` : ''}
              </>
            ) : (
              <>
                <span>📤</span>
                {currentSop ? 'Replace SOP Document' : 'Upload SOP Document'}
              </>
            )}
          </label>
          <div className="text-[10px] font-bold text-text-muted text-center mt-2">
            Accepts PDF, Word (.doc / .docx), or plain text (.txt) — max 50MB
          </div>

          {uploading && progress > 0 && (
            <div className="mt-3 h-1.5 bg-surface2 rounded-full overflow-hidden border border-border/40">
              <div
                className="h-full rounded-full transition-all duration-300 bg-[#0f766e]"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Sop = () => {
  const queryClient = useQueryClient();
  const { data: sops = [], isLoading, refetch } = useQuery({
    queryKey: ['sop', 'all'],
    queryFn: () => sopApi.getAllSops().then(res => res.data),
    staleTime: 2 * 60 * 1000,
  });

  const getSop = (role) => sops.find(s => s.role === role) || null;

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries(['sop']);
    refetch();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="px-2.5 py-1 rounded-md bg-surface2 text-text-muted text-[10px] font-bold uppercase tracking-wider border border-border/40">
            Management
          </div>
          <span className="text-text-muted opacity-30">/</span>
          <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider">SOP Documents</span>
        </div>
        <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">SOP Management</h1>
        <p className="text-sm text-text-muted mt-1 font-medium">
          Upload Standard Operating Procedures for your team. Each role has one active SOP — uploading replaces the previous version.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber/5 border border-amber/20">
        <span className="text-xl mt-0.5">💡</span>
        <div className="text-[11px] font-bold text-text-muted leading-relaxed">
          <span className="text-text-primary font-black">How SOPs work:</span> Upload a PDF, Word, or text document for each role.
          Industry Managers will see their SOP under <em>My Works → SOP</em>, and District Executives will see theirs in their dashboard.
          Uploading a new document immediately replaces the old one for all users.
        </div>
      </div>

      {/* Two SOP cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[0, 1].map(i => (
            <div key={i} className="card p-8 animate-pulse">
              <div className="h-6 bg-surface2 rounded w-3/4 mb-3" />
              <div className="h-4 bg-surface2 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ROLES.map(config => (
            <SopCard
              key={config.role}
              config={config}
              currentSop={getSop(config.role)}
              onUploadSuccess={handleUploadSuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Sop;
