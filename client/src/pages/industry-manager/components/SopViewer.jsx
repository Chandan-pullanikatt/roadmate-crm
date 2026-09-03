import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sopApi } from '../../../api/sopApi';
import { DashboardSkeleton } from '../../../components/ui';

const ROLE_LABELS = {
  industry_manager: {
    title: 'Industry Manager Documents',
    subtitle: 'Documents shared with Industry Managers',
    icon: '📋',
    accent: 'purple',
  },
  executive: {
    title: 'District Executive Documents',
    subtitle: 'Documents shared with District Executives',
    icon: '📄',
    accent: 'blue',
  },
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

/** Renders whichever document is currently selected. */
const DocumentBody = ({ doc }) => {
  const [textContent, setTextContent] = useState(null);
  const [textLoading, setTextLoading] = useState(false);

  // .txt has no embeddable viewer, so fetch and render the content directly.
  useEffect(() => {
    if (doc?.fileType === 'txt' && doc?.viewUrl) {
      setTextLoading(true);
      setTextContent(null);
      fetch(doc.viewUrl)
        .then(r => r.text())
        .then(text => { setTextContent(text); setTextLoading(false); })
        .catch(() => setTextLoading(false));
    } else {
      setTextContent(null);
    }
  }, [doc?._id, doc?.fileType, doc?.viewUrl]);

  if (!doc) return null;

  if (doc.fileType === 'txt') {
    if (textLoading) {
      return (
        <div className="flex items-center justify-center h-64 text-text-muted text-sm font-bold">
          Loading document…
        </div>
      );
    }
    return (
      <pre className="whitespace-pre-wrap font-sans text-sm text-text-primary leading-relaxed p-8 overflow-auto max-h-[75vh]">
        {textContent || 'Document is empty.'}
      </pre>
    );
  }

  if (doc.fileType === 'doc' || doc.fileType === 'docx') {
    const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(doc.viewUrl)}`;
    return (
      <iframe
        src={officeUrl}
        title={doc.fileName}
        className="w-full rounded-b-2xl border-0"
        style={{ height: '75vh', minHeight: 500 }}
        allowFullScreen
      />
    );
  }

  return (
    <iframe
      src={doc.viewUrl}
      title={doc.fileName}
      className="w-full rounded-b-2xl border-0"
      style={{ height: '75vh', minHeight: 500 }}
    />
  );
};

const SopViewer = ({ role }) => {
  const meta = ROLE_LABELS[role] || ROLE_LABELS.industry_manager;
  const [selectedId, setSelectedId] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['documents', role],
    queryFn: () => sopApi.getDocuments(role).then(res => res.data),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const documents = data?.documents || [];
  const selected = documents.find(d => d._id === selectedId) || documents[0] || null;

  if (isLoading) return <DashboardSkeleton />;

  if (isError || documents.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-700 pb-12">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{meta.title}</h1>
          <p className="text-sm text-text-muted mt-1">{meta.subtitle}</p>
        </div>
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4 opacity-30">{meta.icon}</div>
          <div className="text-text-muted font-bold text-sm">
            {isError
              ? 'Unable to load documents. Please try again.'
              : 'No documents have been shared yet. The founder will upload them soon.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`px-2.5 py-1 rounded-md bg-${meta.accent}-light text-${meta.accent} text-[10px] font-bold uppercase tracking-wider border border-${meta.accent}/10`}>
              Documents
            </div>
            <span className="text-text-muted opacity-30">/</span>
            <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider">{meta.title}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">{meta.title}</h1>
          <p className="text-sm text-text-muted mt-1 font-medium">{meta.subtitle}</p>
        </div>
        <div className="text-[11px] font-bold text-text-muted">
          <span className="px-3 py-1.5 rounded-xl bg-surface2 border border-border/40">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'}
          </span>
        </div>
      </div>

      {/* Document picker — only worth showing once there is more than one */}
      {documents.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {documents.map(doc => (
            <button
              key={doc._id}
              onClick={() => setSelectedId(doc._id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border shadow-sm transition-all flex items-center gap-2 ${
                selected?._id === doc._id
                  ? 'bg-[#f0fdf4] text-[#166534] border-[#dcfce7]'
                  : 'bg-white text-text-muted border-border hover:border-blue/30'
              }`}
              title={doc.fileName}
            >
              <span className="uppercase opacity-60 text-[10px]">{doc.fileType}</span>
              <span className="max-w-[220px] truncate">{doc.title || doc.fileName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Viewer */}
      <div className="card shadow-lg border-border/40 overflow-hidden">
        <div className="card-header border-none px-8 pt-6 pb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">{meta.icon}</span>
            <div className="min-w-0">
              <div className="text-sm font-black text-text-primary truncate">{selected.title || selected.fileName}</div>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">
                {selected.fileType === 'pdf' ? 'PDF Document' : selected.fileType === 'txt' ? 'Text Document' : 'Word Document'}
                {' · '}Added {formatDate(selected.createdAt)}
              </div>
            </div>
          </div>
          <a
            href={selected.viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-4 py-2 rounded-xl bg-surface2 border border-border/40 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary hover:bg-surface3 transition-colors"
          >
            Open in New Tab ↗
          </a>
        </div>

        <div className="border-t border-border/40">
          <DocumentBody doc={selected} />
        </div>
      </div>
    </div>
  );
};

export default SopViewer;
