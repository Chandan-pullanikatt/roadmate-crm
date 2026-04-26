import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Tag, 
  Button, 
  Avatar,
  Modal
} from '../../../components/ui';
import { usersApi } from '../../../api/usersApi';
import { useToast } from '../../../context/ToastContext';

const StaffDocs = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: executives, isLoading } = useQuery({
    queryKey: ['users', 'executives-docs'],
    queryFn: () => usersApi.getUsers({ role: 'executive' }).then(res => res.data)
  });

  const verifyMutation = useMutation({
    mutationFn: (data) => usersApi.updateUser(data.userId, { 
      [`documents.${data.docType}.verified`]: true 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['users', 'executives-docs']);
      addToast("Document verified successfully", "success");
    }
  });

  // Flat mapping user documents to a list
  const docList = [];
  executives?.forEach(user => {
    if (user.documents) {
      Object.entries(user.documents).forEach(([type, doc]) => {
        if (doc && doc.url) {
          docList.push({
            userId: user._id,
            userName: user.name,
            district: user.district,
            industry: user.industry,
            type: type.toUpperCase(),
            file: doc.url.split('/').pop(),
            fullUrl: doc.url,
            date: doc.uploadedAt || user.createdAt,
            status: doc.verified ? 'Verified' : 'Pending Review'
          });
        }
      });
    }
  });

  const filteredDocs = docList.filter(d => 
    d.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <div className="p-8 text-center text-text-muted">Loading documents...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="section-title text-xl">Staff Documents & Compliance</h2>
          <p className="section-sub">Aadhar, PAN & Offer letters for your district team</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex justify-between">
          <h3 className="section-title text-base">Document Repository</h3>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Search staff or doc..." 
              className="bg-surface2 border border-border rounded-lg px-3 py-1 text-xs outline-none focus:border-purple w-48"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface2/50 text-text-muted uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="px-4 py-3">Staff Member</th>
                <th className="px-4 py-3">Document Type</th>
                <th className="px-4 py-3">File Reference</th>
                <th className="px-4 py-3">Upload Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDocs.map((doc, idx) => (
                <tr key={idx} className="hover:bg-surface2/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={doc.userName} size="xs" className="bg-purple text-[8px]" />
                      <div>
                        <div className="font-bold text-sm">{doc.userName}</div>
                        <div className="text-[10px] text-text-muted uppercase font-bold tracking-tight">{doc.district} · {doc.industry}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-xs">{doc.type}</td>
                  <td className="px-4 py-3 text-blue font-mono text-[10px] truncate max-w-[150px]">{doc.file}</td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{new Date(doc.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Tag variant={doc.status === 'Verified' ? 'green' : 'amber'} label={doc.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <a href={doc.fullUrl} target="_blank" rel="noreferrer" className="text-purple hover:underline text-xs font-bold">View</a>
                      {doc.status !== 'Verified' && (
                        <button 
                          className="text-accent hover:underline text-xs font-bold"
                          onClick={() => verifyMutation.mutate({ userId: doc.userId, docType: doc.type.toLowerCase() })}
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-text-muted italic">No documents found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StaffDocs;
