import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sopApi } from '../../../api/sopApi';
import { uploadApi } from '../../../api/uploadApi';
import { useToast } from '../../../context/ToastContext';

const ROLES = [
  {
    role: 'industry_manager',
    label: 'Industry Manager Documents',
    description: 'Visible to all Industry Managers.',
    icon: '🏭',
    accentClass: 'border-[#0f766e] text-[#0f766e] bg-[#0f766e]/5',
  },
  {
    role: 'executive',
    label: 'District Executive Documents',
    description: 'Visible to all District Executives and their managers.',
    icon: '🗺️',
    accentClass: 'border-blue text-blue bg-blue/5',
  },
];

const ALLOWED_TYPES = {
  'application/pdf':     'pdf',
  'application/msword':  'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain':          'txt',
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const DocumentCard = ({ config, documents, onChanged }) => {
  const { addToast } = useToast();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, pct: 0 });
  const [deletingId, setDeletingId] = useState(null);

  // Multiple files can be selected at once; they upload one after another so a
  // single failure doesn't abandon the files that already went up.
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const invalid = files.filter(f => !ALLOWED_TYPES[f.type]);
    if (invalid.length) {
      addToast(`Not allowed: ${invalid.map(f => f.name).join(', ')}. Use PDF, Word or text files.`, 'error');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    let succeeded = 0;
    const failed = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ done: i, total: files.length, pct: 0 });
      try {
        const { data: presign } = await uploadApi.getPresignedUpload({
          folder: 'sop',
          fileName: file.name,
          contentType: file.type,
          entityId: config.role,
        });

        await uploadApi.uploadFileDirect(presign.uploadUrl, file, (pct) =>
          setProgress({ done: i, total: files.length, pct })
        );

        await sopApi.saveDocument({
          role: config.role,
          fileKey: presign.fileKey,
          fileName: file.name,
          fileType: ALLOWED_TYPES[file.type],
          title: file.name.replace(/\.[^.]+$/, ''),
        });
        succeeded++;
      } catch (err) {
        failed.push(file.name);
      }
    }

    if (succeeded) {
      addToast(
        `${succeeded} document${succeeded > 1 ? 's' : ''} uploaded. The team has been notified.`,
        failed.length ? 'warning' : 'success'
      );
      onChanged();
    }
    if (failed.length) addToast(`Failed to upload: ${failed.join(', ')}`, 'error');

    setUploading(false);
    setProgress({ done: 0, total: 0, pct: 0 });
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Remove "${doc.title || doc.fileName}" from the ${config.label}? The team will no longer see it.`)) return;
    setDeletingId(doc._id);
    try {
      await sopApi.deleteDocument(doc._id);
      addToast('Document removed.', 'success');
      onChanged();
    } catch (err) {
      addToast(err?.response?.data?.message || 'Could not remove the document.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={`card p-0 overflow-hidden border-2 ${config.accentClass} shadow-sm hover:shadow-md transition-shadow`}>
      <div className="px-8 pt-7 pb-5 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-3xl">{config.icon}</span>
          <div>
            <div className="text-base font-black text-text-primary">{config.label}</div>
            <div className="text-[11px] font-bold text-text-muted mt-0.5">{config.description}</div>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-xl border border-border/40 bg-surface2 text-text-muted text-[10px] font-black uppercase tracking-wider">
          {documents.length} {documents.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      <div className="px-8 py-5">
        {documents.length === 0 ? (
          <div className="p-4 rounded-xl bg-surface2 border border-dashed border-border/60 text-center text-[11px] font-bold text-text-muted">
            No documents uploaded yet for this role.
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc._id} className="flex items-center justify-between p-4 rounded-xl bg-surface2 border border-border/40">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-surface3 border border-border/40 flex items-center justify-center text-[11px] font-black uppercase text-text-muted">
                    {doc.fileType}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-text-primary truncate">{doc.title || doc.fileName}</div>
                    <div className="text-[10px] font-bold text-text-muted mt-0.5">
                      Added {formatDate(doc.createdAt)}
                      {doc.uploadedBy?.name && ` · by ${doc.uploadedBy.name}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc._id}
                  className="shrink-0 ml-3 px-3 py-1.5 rounded-lg border border-red/20 text-red text-[10px] font-black uppercase tracking-wider hover:bg-red-light transition-colors disabled:opacity-50"
                >
                  {deletingId === doc._id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
            id={`doc-upload-${config.role}`}
            disabled={uploading}
          />
          <label
            htmlFor={`doc-upload-${config.role}`}
            className={`flex items-center justify-center gap-3 w-full py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all text-[11px] font-black uppercase tracking-wider
              ${uploading
                ? 'border-border/40 text-text-muted cursor-not-allowed opacity-60'
                : `border-current ${config.accentClass} hover:opacity-80`
              }`}
          >
            {uploading ? (
              <>
                <span className="animate-spin text-base">⟳</span>
                Uploading {progress.done + 1} of {progress.total}… {progress.pct > 0 ? `${progress.pct}%` : ''}
              </>
            ) : (
              <>
                <span>📤</span>
                Upload Documents
              </>
            )}
          </label>
          <div className="text-[10px] font-bold text-text-muted text-center mt-2">
            Select one or more PDF, Word (.doc / .docx) or text (.txt) files — max 50MB each
          </div>

          {uploading && progress.pct > 0 && (
            <div className="mt-3 h-1.5 bg-surface2 rounded-full overflow-hidden border border-border/40">
              <div className="h-full rounded-full transition-all duration-300 bg-[#0f766e]" style={{ width: `${progress.pct}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Documents = () => {
  const queryClient = useQueryClient();
  const { data: docs = [], isLoading, refetch } = useQuery({
    queryKey: ['documents', 'all'],
    queryFn: () => sopApi.getAllDocuments().then(res => res.data),
    staleTime: 2 * 60 * 1000,
  });

  const forRole = (role) => docs.filter(d => d.role === role);

  const handleChanged = () => {
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    refetch();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-12">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="px-2.5 py-1 rounded-md bg-surface2 text-text-muted text-[10px] font-bold uppercase tracking-wider border border-border/40">
            Management
          </div>
          <span className="text-text-muted opacity-30">/</span>
          <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider">Documents</span>
        </div>
        <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Documents</h1>
        <p className="text-sm text-text-muted mt-1 font-medium">
          Publish documents to your team. Each role can hold as many as you need.
        </p>
      </div>

      <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber/5 border border-amber/20">
        <span className="text-xl mt-0.5">💡</span>
        <div className="text-[11px] font-bold text-text-muted leading-relaxed">
          <span className="text-text-primary font-black">How this works:</span> Upload one or more PDF, Word or text files
          for a role. Everyone in that role is notified as soon as a document is added, and it appears in their
          Documents tab straight away. Removing a document takes it off their list.
        </div>
      </div>

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
            <DocumentCard
              key={config.role}
              config={config}
              documents={forRole(config.role)}
              onChanged={handleChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Documents;
