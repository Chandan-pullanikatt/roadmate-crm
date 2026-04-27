import React, { useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useNotificationStore } from '../store/useNotificationStore';
import { useToast } from '../context/ToastContext';

const NotificationListener = () => {
  const socket = useSocket();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { addToast } = useToast();

  useEffect(() => {
    if (!socket) return;

    // Attendance Updates
    const handleAttendanceUpdated = (data) => {
      const msg = data.message || `Attendance status updated to ${data.status}`;
      addToast(msg, 'success');
      addNotification({
        title: 'Attendance Update',
        message: msg,
        type: 'attendance'
      });
    };

    // Lead Allocation/Updates
    const handleLeadUpdated = (data) => {
      const msg = data.message || `Lead ${data.title} has been updated`;
      addToast(msg, 'success');
      addNotification({
        title: 'Lead Update',
        message: msg,
        type: 'lead'
      });
    };

    // Meeting Scheduled
    const handleMeetingScheduled = (data) => {
      const msg = `New meeting scheduled for lead: ${data.leadName || 'Client'}`;
      addToast(msg, 'success');
      addNotification({
        title: 'Meeting Scheduled',
        message: msg,
        type: 'meeting'
      });
    };

    // Leave Requests (for Managers)
    const handleLeaveRequested = (data) => {
      const msg = `${data.userName} requested leave for ${data.days} days`;
      addToast(msg, 'warning');
      addNotification({
        title: 'Leave Request',
        message: msg,
        type: 'leave_request'
      });
    };

    // Leave Approval/Rejection (for Staff)
    const handleLeaveStatus = (data) => {
      const isApproved = data.status === 'approved';
      const msg = `Your leave request has been ${data.status}`;
      addToast(msg, isApproved ? 'success' : 'error');
      addNotification({
        title: 'Leave Update',
        message: msg,
        type: isApproved ? 'leave_approved' : 'leave_rejected'
      });
    };

    socket.on('attendance:updated', handleAttendanceUpdated);
    socket.on('lead:updated', handleLeadUpdated);
    socket.on('meeting:scheduled', handleMeetingScheduled);
    socket.on('leave:requested', handleLeaveRequested);
    socket.on('leave:approved', handleLeaveStatus);
    socket.on('leave:rejected', handleLeaveStatus);

    return () => {
      socket.off('attendance:updated', handleAttendanceUpdated);
      socket.off('lead:updated', handleLeadUpdated);
      socket.off('meeting:scheduled', handleMeetingScheduled);
      socket.off('leave:requested', handleLeaveRequested);
      socket.off('leave:approved', handleLeaveStatus);
      socket.off('leave:rejected', handleLeaveStatus);
    };
  }, [socket, addNotification, addToast]);

  return null; // This component doesn't render anything
};

export default NotificationListener;
