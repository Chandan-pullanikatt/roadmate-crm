import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import DashboardSkeleton from '../../../components/skeletons/DashboardSkeleton';
import { leaveApi } from '../../../api/leaveApi';
import { Avatar, Button, Tag } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const LeaveCalendar = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  // Section 1: Pending Approvals
  const { data: pendingLeaves, isLoading: pendingLoading } = useQuery({
    queryKey: ['leaves', 'pending'],
    queryFn: () => leaveApi.getPendingLeaves().then(res => res.data),
    staleTime: 2 * 60 * 1000,
  });

  // Section 2: All Team Leaves (for calendar/history)
  const { data: allLeaves, isLoading: leavesLoading } = useQuery({
    queryKey: ['leaves', { month: selectedMonth }],
    queryFn: () => leaveApi.getLeaves({ month: selectedMonth }).then(res => res.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData
  });

  const approveMutation = useMutation({
    mutationFn: (id) => leaveApi.approveLeave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      addToast("Leave request approved", "success");
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Failed to approve leave", "error");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => leaveApi.rejectLeave(id, { approvalNote: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      addToast("Leave request rejected", "success");
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Failed to reject leave", "error");
    }
  });

  if (pendingLoading || leavesLoading) return <DashboardSkeleton />;

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <div className="section-header">
        <div>
          <div className="section-title">Leave Management</div>
          <div className="section-sub">Approve team requests and track attendance across the organization</div>
        </div>
      </div>

      {/* SECTION 1: PENDING APPROVALS */}
      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10 flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold">Pending Approvals</h3>
            <Tag variant="amber" label={`${pendingLeaves?.length || 0} Pending`} />
          </div>
        </div>
        <div className="divide-y divide-border overflow-x-auto">
          {pendingLeaves?.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface2/50 text-[10px] font-black uppercase tracking-widest text-text-muted">
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Dates</th>
                  <th className="px-6 py-3 text-center">Days</th>
                  <th className="px-6 py-3">Reason</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingLeaves.map(leave => (
                  <tr key={leave._id} className="hover:bg-surface2/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={leave.user?.name} size="xs" />
                        <div>
                          <div className="text-xs font-bold">{leave.user?.name}</div>
                          <div className="text-[10px] text-text-muted capitalize">{leave.user?.role?.replace('_', ' ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Tag variant={leave.type === 'paid' ? 'blue' : 'gray'} label={leave.type} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium">
                        {new Date(leave.fromDate).toLocaleDateString()} - {new Date(leave.toDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold bg-surface2 px-2 py-1 rounded-lg">{leave.days}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[11px] text-text-secondary italic max-w-[200px] truncate" title={leave.reason}>
                        "{leave.reason}"
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="xs" 
                          className="bg-green text-white"
                          onClick={() => approveMutation.mutate(leave._id)}
                          loading={approveMutation.isPending}
                        >
                          Approve
                        </Button>
                        <Button 
                          size="xs" 
                          variant="outline" 
                          className="text-red border-red/10 hover:bg-red/5"
                          onClick={() => {
                            const reason = prompt("Enter rejection reason:");
                            if (reason) rejectMutation.mutate({ id: leave._id, reason });
                          }}
                          loading={rejectMutation.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-text-muted text-xs italic">
              No pending leave requests
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: LEAVE CALENDAR / HISTORY */}
      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10 flex justify-between items-center px-6 py-4">
          <h3 className="text-sm font-bold">Leave Calendar / History</h3>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase text-text-muted">Month:</label>
            <select 
              className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-accent transition-all"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {months.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="divide-y divide-border overflow-x-auto">
          {allLeaves?.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface2/50 text-[10px] font-black uppercase tracking-widest text-text-muted">
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">From</th>
                  <th className="px-6 py-3">To</th>
                  <th className="px-6 py-3 text-center">Days</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allLeaves.map(leave => (
                  <tr key={leave._id} className="hover:bg-surface2/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={leave.user?.name} size="xs" />
                        <div className="text-xs font-bold">{leave.user?.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs capitalize">{leave.type}</td>
                    <td className="px-6 py-4 text-xs">{new Date(leave.fromDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-xs">{new Date(leave.toDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-medium">{leave.days}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Tag 
                        variant={leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'red' : 'amber'} 
                        label={leave.status} 
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-text-muted text-xs italic">
              No leave records for this month
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveCalendar;
