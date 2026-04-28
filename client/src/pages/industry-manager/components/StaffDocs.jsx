import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag, Button, Avatar, DashboardSkeleton } from '../../../components/ui';
import FileUpload from '../../../components/ui/FileUpload';
import { usersApi } from '../../../api/usersApi';
import { uploadApi } from '../../../api/uploadApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { useToast } from '../../../context/ToastContext';

const StaffDocs = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeUploadUserId, setActiveUploadUserId] = useState(null);

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  const { data: executives, isLoading: execsLoading } = useQuery({
    queryKey: ['users', 'executives-docs'],
    queryFn: () => usersApi.getUsers({ role: 'executive' }).then((res) => res.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev
  });

  const uploadMutation = useMutation({
    mutationFn: ({ userId, file }) =>
      usersApi.addUserDocument(userId, {
        name: file.name || file.fileName,
        url: file.url,
        fileKey: file.fileKey,
        size: file.size,
        contentType: file.contentType
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'executives-docs'] });
      addToast('Document uploaded successfully', 'success');
      setActiveUploadUserId(null);
    },
    onError: (err) => {
      addToast(err.response?.data?.message || 'Failed to save document', 'error');
    }
  });

  const userInfo = dashData?.user || {};

  const filteredExecutives = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return executives || [];

    return (executives || []).filter((exec) => {
      const haystack = [
        exec.name,
        exec.email,
        exec.phone,
        exec.district,
        exec.industry
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [executives, searchTerm]);

  if ((dashLoading || execsLoading) && !executives) return <DashboardSkeleton />;

  const getDocIcon = (name = '') => {
    const t = name.toLowerCase();
    if (t.includes('aadhaar')) return 'ID';
    if (t.includes('pan')) return 'PAN';
    if (t.includes('offer')) return 'HR';
    if (t.includes('agreement')) return 'AGR';
    if (t.includes('training')) return 'TRN';
    return 'DOC';
  };

  const getDocCategory = (name = '') => {
    const t = name.toLowerCase();
    if (t.includes('aadhaar') || t.includes('pan')) return 'ID';
    if (t.includes('offer') || t.includes('agreement')) return 'HR';
    if (t.includes('training')) return 'Training';
    return 'Misc';
  };

  const openDocument = async (doc) => {
    if (!doc.fileKey) {
      addToast('This document is missing its storage key', 'error');
      return;
    }

    try {
      const res = await uploadApi.getPresignedDownload(doc.fileKey);
      window.open(res.data.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      addToast(err.response?.data?.message || 'Unable to open document', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Staff Documents</h1>
          <p className="text-sm text-text-muted">Upload & manage executive documents</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search executives..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-surface2 border border-border rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-purple/20 transition-all outline-none min-w-[280px]"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-sm">🔍</span>
          </div>
          <button className="w-10 h-10 rounded-xl bg-surface2 border border-border flex items-center justify-center hover:bg-surface3 transition-colors relative">
            <span className="text-lg">🔔</span>
          </button>
          <Avatar name={userInfo.name} size="md" className="border-2 border-purple/10" />
        </div>
      </div>

      <div className="bg-surface1 border border-border/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold">Staff Documents · {userInfo.industry} Executives</h2>
          <p className="text-xs text-text-muted">Upload, view & manage executive documents</p>
        </div>
        <Tag variant="purple" label={`${filteredExecutives.length} Staff`} className="font-black px-5" />
      </div>

      <div className="card shadow-lg shadow-purple/5 border-border/40 p-8">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-tight mb-8">All Staff Documents</h3>

        <div className="space-y-10">
          {filteredExecutives.map((exec, idx) => (
            <div key={exec._id || idx} className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={exec.name} size="sm" className={`av-${idx % 5} rounded-lg shadow-sm`} />
                <div className="flex-1">
                  <span className="text-sm font-black text-text-primary uppercase tracking-tight">{exec.name}</span>
                  <div className="text-[10px] text-text-muted">
                    {[exec.district, exec.industry].filter(Boolean).join(' · ') || 'Executive'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pl-1">
                {Array.isArray(exec.documents) && exec.documents.length > 0 ? (
                  exec.documents.map((doc, dIdx) => (
                    <button
                      type="button"
                      key={`${exec._id}-${dIdx}`}
                      className="w-44 bg-surface2/50 border border-border/40 rounded-xl p-4 flex items-center gap-3 group hover:bg-white hover:shadow-md transition-all cursor-pointer text-left"
                      onClick={() => openDocument(doc)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-white shadow-inner flex items-center justify-center text-[11px] font-black">
                        {getDocIcon(doc.name)}
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-text-primary leading-tight">{doc.name}</p>
                        <p className="text-[9px] font-bold text-text-muted uppercase mt-0.5 tracking-tighter">
                          {getDocCategory(doc.name)} · {new Date(doc.uploadedAt || exec.createdAt).toLocaleString('default', { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="w-44 bg-surface2/40 border border-border/40 rounded-xl p-4 flex items-center justify-center text-center text-[11px] font-bold text-text-muted">
                    No documents uploaded
                  </div>
                )}

                <div className="w-44 bg-white border-2 border-dashed border-border/40 rounded-xl p-4 flex items-center justify-center gap-2 group hover:border-purple/40 hover:bg-purple-light/5 transition-all">
                  {activeUploadUserId === exec._id ? (
                    <FileUpload
                      folder="staff-documents"
                      entityId={exec._id}
                      label="Upload document"
                      subtitle="PDF, JPG, PNG, DOC up to 10MB"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onUploadComplete={(file) => uploadMutation.mutate({ userId: exec._id, file })}
                    />
                  ) : (
                    <Button
                      variant="outline"
                      className="text-[11px] font-black text-text-muted group-hover:text-purple uppercase tracking-widest border-none bg-transparent shadow-none"
                      onClick={() => setActiveUploadUserId(exec._id)}
                    >
                      + Add Document
                    </Button>
                  )}
                </div>
              </div>
              {idx < filteredExecutives.length - 1 && <div className="h-px bg-border/40 w-full mt-6" />}
            </div>
          ))}

          {filteredExecutives.length === 0 && (
            <div className="text-center text-sm text-text-muted py-10">No executives match this search.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffDocs;
