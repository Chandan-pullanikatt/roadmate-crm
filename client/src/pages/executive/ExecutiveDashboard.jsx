import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
// Components
import MyWorkToday from './components/MyWorkToday';
import Meetings from './components/Meetings';
import LeadList from './components/LeadList';
import Attendance from './components/Attendance';
import LeaveManagement from './components/LeaveManagement';
import Performance from './components/Performance';
import HierarchyStatus from './components/HierarchyStatus';

const ExecutiveDashboard = () => {
  const [searchParams] = useSearchParams();
  const page = searchParams.get('page') || 'work';
  const [activeMeeting, setActiveMeeting] = useState(null);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleMeetingAlert = (meeting) => {
      // Calculate 1 hour before
      const meetingTime = new Date(meeting.meetingAt).getTime();
      const now = new Date().getTime();
      const delay = (meetingTime - now) - (60 * 60 * 1000);

      if (delay > 0) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('open-modal', { detail: 'modal-meeting' }));
        }, delay);
      } else if (meetingTime > now) {
        // Meeting is within 1 hour
        window.dispatchEvent(new CustomEvent('open-modal', { detail: 'modal-meeting' }));
      }
    };

    socket.on('meeting:scheduled', handleMeetingAlert);
    return () => socket.off('meeting:scheduled');
  }, [socket]);

  const renderContent = () => {
    switch (page.toLowerCase()) {
      case 'work': return <MyWorkToday />;
      case 'meetings': return <Meetings />;
      case 'leads': return <LeadList />;
      case 'leave-calendar': return <Attendance />;
      case 'attendance': return <Attendance />;
      case 'leave': return <LeaveManagement />;
      case 'reports-v2': return <Performance />;
      case 'performance': return <Performance />;
      case 'hierarchy': return <HierarchyStatus />;
      default: return <MyWorkToday />;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {renderContent()}
    </div>
  );
};

export default ExecutiveDashboard;
