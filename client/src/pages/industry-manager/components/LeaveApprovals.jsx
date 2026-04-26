import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../../api/leaveApi';
import { Button, Avatar, Tag, Modal } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const LeaveApprovals = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const { data: leaves, isLoading } = useQuery({
    queryKey: ['leaves', 'im-approvals'],
    queryFn: () => leaveApi.getLeaves().then(res => res.data)
  });

  // Filter only pending leaves from subordinates
  const pendingLeaves = leaves?.filter(l => l.status === 'pending') || [];

  const approveMutation = useMutation({
    mutationFn: leaveApi.approveLeave,
    onSuccess: () => {
      queryClient.invalidateQueries(['leaves', 'im-approvals']);
      addToast("Leave request approved", "success");
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Approval failed", "error");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (data) => leaveApi.rejectLeave(data.id, { approvalNote: data.note }),
    onSuccess: () => {
      queryClient.invalidateQueries(['leaves', 'im-approvals']);
      setIsRejectModalOpen(false);
      setRejectionNote('');
      addToast("Leave request rejected", "error");
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Rejection failed", "error");
    }
  });

  if (isLoading) return <div className="p-8 text-center text-text-muted">Loading leave requests...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl font-bold text-text-primary tracking-tight">Pending Leave Approvals</h2>
        <p className="text-sm text-text-muted">Review and approve district executive leave requests.</p>
      </div>

      {pendingLeaves.length === 0 ? (
        <div className="bg-surface border border-border border-dashed rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-surface2 flex items-center justify-center mx-auto mb-4 text-2xl">🌴</div>
            <p className="text-sm font-bold text-text-primary">No pending requests</p>
            <p className="text-[11px] text-text-muted mt-1">All leave requests for your district have been processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingLeaves.map(leave => (
            <div key={leave._id} className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                   <Avatar name={leave.user.name} size="md" />
                   <div>
                      <p className="font-bold text-sm text-text-primary">{leave.user.name}</p>
                      <p className="text-[10px] text-purple font-bold uppercase tracking-tight">{leave.user.district} · {leave.user.industry}</p>
                   </div>
                </div>
                <Tag variant="amber" className="text-[9px] font-black">{leave.type.replace('_', ' ').toUpperCase()}</Tag>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-surface2/50 rounded-xl p-4 mb-4 border border-border/50">
                <div>
                   <p className="text-[9px] font-bold text-text-muted uppercase mb-0.5">Duration</p>
                   <p className="text-sm font-bold text-text-primary">{leave.days} Day{leave.days > 1 && 's'}</p>
                </div>
                <div>
                   <p className="text-[9px] font-bold text-text-muted uppercase mb-0.5">Dates</p>
                   <p className="text-xs font-medium text-text-secondary">
                      {new Date(leave.fromDate).toLocaleDateString()} - {new Date(leave.toDate).toLocaleDateString()}
                   </p>
                </div>
              </div>

              <div className="mb-6 px-1">
                 <p className="text-[9px] font-bold text-text-muted uppercase mb-1">Reason</p>
                 <p className="text-xs text-text-secondary leading-relaxed italic">"{leave.reason}"</p>
              </div>

              <div className="flex gap-2">
                 <Button 
                   className="flex-1 bg-accent text-white hover:bg-accent/90" 
                   onClick={() => approveMutation.mutate(leave._id)}
                   disabled={approveMutation.isLoading}
                 >
                   {approveMutation.isLoading ? "Approve..." : "Approve"}
                 </Button>
                 <Button 
                   variant="outline" 
                   className="flex-1 border-red/30 text-red hover:bg-red-light"
                   onClick={() => {
                     setSelectedLeave(leave);
                     setIsRejectModalOpen(true);
                   }}
                 >
                   Reject
                 </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isRejectModalOpen && (
        <Modal
          onClose={() => setIsRejectModalOpen(false)}
          title="Reject Leave Request"
          subtitle={`Please provide a reason for rejecting ${selectedLeave?.user?.name}'s leave.`}
        >
          <div className="space-y-4 pt-2">
             <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase">Rejection Reason</label>
                <textarea 
                  className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl focus:ring-2 focus:ring-red/20 focus:border-red outline-none transition-all text-sm min-h-[120px]"
                  placeholder="Ex: Critical lead follow-ups pending for this district. Alternative dates suggested."
                  value={rejectionNote}
                  onChange={e => setRejectionNote(e.target.value)}
                />
             </div>

             <div className="pt-4 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
                <Button 
                  className="flex-1 bg-red text-white hover:bg-red/90 shadow-lg shadow-red/20"
                  onClick={() => rejectMutation.mutate({ id: selectedLeave._id, note: rejectionNote })}
                  disabled={!rejectionNote || rejectMutation.isLoading}
                >
                  {rejectMutation.isLoading ? "Rejecting..." : "Confirm Rejection"}
                </Button>
             </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default LeaveApprovals;
