import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Tag, 
  Button, 
  Avatar,
  Modal
} from '../../../components/ui';
import { usersApi } from '../../../api/usersApi';
import { dashboardApi } from '../../../api/dashboardApi';
import { useToast } from '../../../context/ToastContext';

const StaffDocs = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 'industry-manager'],
    queryFn: () => dashboardApi.getIndustryManagerDashboard().then(res => res.data)
  });

  const { data: executives, isLoading } = useQuery({
    queryKey: ['users', 'executives-docs'],
    queryFn: () => usersApi.getUsers({ role: 'executive' }).then(res => res.data)
  });

  const userInfo = dashData?.user || {};

  if (isLoading) return (
    <div className="p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple mx-auto mb-4"></div>
        <div className="text-text-muted font-medium">Accessing secure document vault...</div>
    </div>
  );

  const getDocIcon = (type) => {
    const t = type.toLowerCase();
    if (t.includes('aadhaar')) return '🆔';
    if (t.includes('pan')) return '💳';
    if (t.includes('offer')) return '📄';
    if (t.includes('agreement')) return '📑';
    if (t.includes('training')) return '🎓';
    return '📁';
  };

  const getDocCategory = (type) => {
    const t = type.toLowerCase();
    if (t.includes('aadhaar') || t.includes('pan')) return 'ID';
    if (t.includes('offer') || t.includes('agreement')) return 'HR';
    if (t.includes('training')) return 'Training';
    return 'MISC';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Staff Documents</h1>
          <p className="text-sm text-text-muted">Upload & manage executive documents</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Search leads, executives..." 
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

      {/* Sub Header Card */}
      <div className="bg-surface1 border border-border/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold">Staff Documents · {userInfo.industry} Executives</h2>
          <p className="text-xs text-text-muted">Upload, view & manage executive documents</p>
        </div>
        <Button className="bg-purple text-white border-none rounded-xl px-5 h-10 font-bold text-[11px] uppercase tracking-widest shadow-lg shadow-purple/10">
            + Upload Document
        </Button>
      </div>

      {/* Main Content Card */}
      <div className="card shadow-lg shadow-purple/5 border-border/40 p-8">
        <h3 className="text-sm font-black text-text-primary uppercase tracking-tight mb-8">All Staff Documents</h3>

        <div className="space-y-10">
            {executives?.map((exec, idx) => (
                <div key={exec._id || idx} className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Avatar name={exec.name} size="sm" className={`av-${idx % 5} rounded-lg shadow-sm`} />
                        <span className="text-sm font-black text-text-primary uppercase tracking-tight">{exec.name}</span>
                    </div>

                    <div className="flex flex-wrap gap-4 pl-1">
                        {/* Render existing documents if any, else show placeholder cards like screenshot */}
                        {exec.documents && Object.entries(exec.documents).length > 0 ? (
                             Object.entries(exec.documents).map(([type, doc], dIdx) => (
                                <div key={dIdx} className="w-44 bg-surface2/50 border border-border/40 rounded-xl p-4 flex items-center gap-3 group hover:bg-white hover:shadow-md transition-all cursor-pointer">
                                    <div className="w-10 h-10 rounded-lg bg-white shadow-inner flex items-center justify-center text-xl">
                                        {getDocIcon(type)}
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-text-primary leading-tight">{type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}</p>
                                        <p className="text-[9px] font-bold text-text-muted uppercase mt-0.5 tracking-tighter">
                                            {getDocCategory(type)} · {new Date(doc.uploadedAt || exec.createdAt).toLocaleString('default', { month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                             ))
                        ) : (
                            /* Fallback to mock-like placeholders if no docs exist, but structure is dynamic */
                            <>
                                <div className="w-44 bg-surface2/50 border border-border/40 rounded-xl p-4 flex items-center gap-3 group hover:bg-white hover:shadow-md transition-all cursor-pointer opacity-60">
                                    <div className="w-10 h-10 rounded-lg bg-white shadow-inner flex items-center justify-center text-xl">🆔</div>
                                    <div>
                                        <p className="text-[11px] font-black text-text-primary leading-tight">Aadhaar Card</p>
                                        <p className="text-[9px] font-bold text-text-muted uppercase mt-0.5 tracking-tighter">ID · {new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}</p>
                                    </div>
                                </div>
                                <div className="w-44 bg-surface2/50 border border-border/40 rounded-xl p-4 flex items-center gap-3 group hover:bg-white hover:shadow-md transition-all cursor-pointer opacity-60">
                                    <div className="w-10 h-10 rounded-lg bg-white shadow-inner flex items-center justify-center text-xl">📄</div>
                                    <div>
                                        <p className="text-[11px] font-black text-text-primary leading-tight">Offer Letter</p>
                                        <p className="text-[9px] font-bold text-text-muted uppercase mt-0.5 tracking-tighter">HR · {new Date().toLocaleString('default', { month: 'short', year: 'numeric' })}</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Add Document Placeholder */}
                        <div className="w-44 bg-white border-2 border-dashed border-border/40 rounded-xl p-4 flex items-center justify-center gap-2 group hover:border-purple/40 hover:bg-purple-light/5 transition-all cursor-pointer">
                            <span className="text-[11px] font-black text-text-muted group-hover:text-purple uppercase tracking-widest">+ Add Document</span>
                        </div>
                    </div>
                    {idx < executives.length - 1 && <div className="h-px bg-border/40 w-full mt-6" />}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default StaffDocs;
