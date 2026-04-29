import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Tag, Avatar, DashboardSkeleton } from '../ui';
import { leaveApi } from '../../api/leaveApi';
import { format } from 'date-fns';

const LeaveHistoryModal = ({ isOpen, onClose, user }) => {
  const { data: history, isLoading } = useQuery({
    queryKey: ['leave', 'history', user?._id],
    queryFn: () => leaveApi.getLeaves({ userId: user?._id }).then(res => res.data),
    enabled: !!user?._id && isOpen
  });

  const { data: balance } = useQuery({
    queryKey: ['leave', 'balance', user?._id],
    queryFn: () => leaveApi.getLeaveBalance(user?._id).then(res => res.data),
    enabled: !!user?._id && isOpen
  });

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Leave History & Balance"
      subtitle={`Viewing leave records for ${user.name}`}
      className="modal-lg"
    >
      <div className="space-y-8 py-2">
        {/* Profile Summary */}
        <div className="flex items-center gap-4 p-4 bg-surface2/30 rounded-2xl border border-border">
          <Avatar name={user.name} size="lg" />
          <div className="flex-1">
            <div className="text-[16px] font-bold text-text-primary">{user.name}</div>
            <div className="text-[12px] text-text-muted uppercase tracking-wider font-bold">
              {user.role?.replace('_', ' ')} · {user.state}
            </div>
          </div>
          <div className="flex gap-6 pr-4 border-l border-border pl-8">
            <div className="text-center">
              <div className="text-[18px] font-black text-blue">{balance?.paidLeaveBalance || 0}</div>
              <div className="text-[10px] text-text-muted uppercase font-bold">Paid Balance</div>
            </div>
            <div className="text-center">
              <div className="text-[18px] font-black text-teal">{balance?.approvedThisMonth || 0}</div>
              <div className="text-[10px] text-text-muted uppercase font-bold">Used This Month</div>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="space-y-4">
          <div className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em]">Recent Applications</div>
          
          <div className="border border-border rounded-2xl overflow-hidden bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface2/50 border-b border-border">
                  <th className="p-4 pl-6 text-[11px] font-black uppercase text-text-muted tracking-widest">Type / Dates</th>
                  <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Duration</th>
                  <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Status</th>
                  <th className="p-4 text-[11px] font-black uppercase text-text-muted tracking-widest">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan="4" className="p-8"><DashboardSkeleton /></td>
                  </tr>
                ) : history?.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-12 text-center text-text-muted italic">No leave history found for this user.</td>
                  </tr>
                ) : (
                  history.map(leave => (
                    <tr key={leave._id} className="hover:bg-surface2/30 transition-all">
                      <td className="p-4 pl-6">
                        <div className="font-bold text-[14px] capitalize">{leave.type} Leave</div>
                        <div className="text-[11px] text-text-muted">{format(new Date(leave.fromDate), 'MMM dd')} - {format(new Date(leave.toDate), 'MMM dd, yyyy')}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-[13px] font-black text-text-primary">{leave.days} Days</div>
                        <div className="text-[11px] text-text-muted">Requested {format(new Date(leave.requestedAt), 'PP')}</div>
                      </td>
                      <td className="p-4">
                        <Tag 
                          variant={leave.status === 'approved' ? 'green' : leave.status === 'rejected' ? 'red' : 'amber'} 
                          label={leave.status.toUpperCase()} 
                        />
                      </td>
                      <td className="p-4 text-[12px] font-medium text-text-secondary max-w-xs truncate" title={leave.reason}>
                        {leave.reason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border mt-6">
          <button className="btn btn-primary px-10" onClick={onClose}>Close History</button>
        </div>
      </div>
    </Modal>
  );
};

export default LeaveHistoryModal;
