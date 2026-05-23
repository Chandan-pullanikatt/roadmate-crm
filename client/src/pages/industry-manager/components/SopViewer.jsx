import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sopApi } from '../../../api/sopApi';
import { DashboardSkeleton } from '../../../components/ui';

const ROLE_LABELS = {
  industry_manager: {
    title: 'Industry Manager SOP',
    subtitle: 'Standard Operating Procedure — How Industry Managers should work',
    icon: '📋',
    accent: 'purple',
  },
  executive: {
    title: 'District Executive SOP',
    subtitle: 'Standard Operating Procedure — How District Executives should work',
    icon: '📄',
    accent: 'blue',
  },
};

const SopViewer = ({ role }) => {
  const meta = ROLE_LABELS[role] || ROLE_LABELS.industry_manager;
  const [textContent, setTextContent] = useState(null);
  const [textLoading, setTextLoading] = useState(false);

  const { data: sop, isLoading, isError, error } = useQuery({
    queryKey: ['sop', role],
    queryFn: () => sopApi.getSop(role).then(res => res.data),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  // For .txt files, fetch the content as text
  useEffect(() => {
    if (sop?.fileType === 'txt' && sop?.viewUrl) {
      setTextLoading(true);
      fetch(sop.viewUrl)
        .then(r => r.text())
        .then(text => {
          setTextContent(text);
          setTextLoading(false);
        })
        .catch(() => setTextLoading(false));
    } else {
      setTextContent(null);
    }
  }, [sop?.fileType, sop?.viewUrl]);

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !sop) {
    return (
      <div className="space-y-6 animate-in fade-in duration-700 pb-12">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{meta.title}</h1>
          <p className="text-sm text-text-muted mt-1">{meta.subtitle}</p>
        </div>
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4 opacity-30">{meta.icon}</div>
          <div className="text-text-muted font-bold text-sm">
            {error?.response?.status === 404
              ? 'No SOP has been uploaded yet. The founder will upload it soon.'
              : 'Unable to load SOP. Please try again.'}
          </div>
        </div>
      </div>
    );
  }

  const renderViewer = () => {
    const { fileType, viewUrl } = sop;

    // Plain text
    if (fileType === 'txt') {
      if (textLoading) return (
        <div className="flex items-center justify-center h-64 text-text-muted text-sm font-bold">
          Loading document…
        </div>
      );
      return (
        <pre className="whitespace-pre-wrap font-sans text-sm text-text-primary leading-relaxed p-8 overflow-auto max-h-[75vh]">
          {textContent || 'Document is empty.'}
        </pre>
      );
    }

    // Word docs — Microsoft Office Online viewer
    if (fileType === 'doc' || fileType === 'docx') {
      const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewUrl)}`;
      return (
        <iframe
          src={officeUrl}
          title={sop.fileName}
          className="w-full rounded-b-2xl border-0"
          style={{ height: '75vh', minHeight: 500 }}
          allowFullScreen
        />
      );
    }

    // PDF — native browser viewer
    return (
      <iframe
        src={viewUrl}
        title={sop.fileName}
        className="w-full rounded-b-2xl border-0"
        style={{ height: '75vh', minHeight: 500 }}
      />
    );
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={`px-2.5 py-1 rounded-md bg-${meta.accent}-light text-${meta.accent} text-[10px] font-bold uppercase tracking-wider border border-${meta.accent}/10`}>
              SOP
            </div>
            <span className="text-text-muted opacity-30">/</span>
            <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider">{meta.title}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">{meta.title}</h1>
          <p className="text-sm text-text-muted mt-1 font-medium">{meta.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold text-text-muted">
          <span className="px-3 py-1.5 rounded-xl bg-surface2 border border-border/40">
            {sop.fileName}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-surface2 border border-border/40 uppercase">
            {sop.fileType}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-surface2 border border-border/40">
            Updated {formatDate(sop.updatedAt)}
          </span>
        </div>
      </div>

      {/* Document Viewer Card */}
      <div className="card shadow-lg border-border/40 overflow-hidden">
        <div className="card-header border-none px-8 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <div className="text-sm font-black text-text-primary">{sop.fileName}</div>
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">
                {sop.fileType === 'pdf' ? 'PDF Document' : sop.fileType === 'txt' ? 'Text Document' : 'Word Document'}
              </div>
            </div>
          </div>
          <a
            href={sop.viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-surface2 border border-border/40 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary hover:bg-surface3 transition-colors"
          >
            Open in New Tab ↗
          </a>
        </div>

        <div className="border-t border-border/40">
          {renderViewer()}
        </div>
      </div>
    </div>
  );
};

export default SopViewer;
