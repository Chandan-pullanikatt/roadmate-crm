import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../api/leadsApi';
import { useToast } from '../context/ToastContext';

export const useMeetingAlerts = (userRole) => {
  const { addToast } = useToast();
  const notifiedMeetings = useRef(new Set()); // Track notified lead IDs
  
  // We fetch leads with status 'meeting_virtual' or 'meeting_direct'
  const { data } = useQuery({
    queryKey: ['upcoming-meetings'],
    queryFn: () => leadsApi.getLeads({ 
      status: 'meeting_virtual,meeting_direct', 
      limit: 100 
    }).then(res => res.data),
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes
    enabled: !!userRole && userRole === 'executive' // Usually only executives conduct the meetings
  });

  // Request browser notification permission on mount
  useEffect(() => {
    if (userRole === 'executive' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [userRole]);

  // Evaluate meetings for alerts
  useEffect(() => {
    if (!data?.leads) return;

    const now = new Date().getTime();
    
    data.leads.forEach(lead => {
      if (!lead.meetingAt) return;
      
      const meetingTime = new Date(lead.meetingAt).getTime();
      const timeDiff = meetingTime - now;
      
      // Check if meeting is between 50 and 65 minutes away
      const minutesDiff = timeDiff / (1000 * 60);
      
      if (minutesDiff > 50 && minutesDiff <= 65) {
        if (!notifiedMeetings.current.has(lead._id)) {
          // Trigger alert
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Upcoming Meeting', {
              body: `Meeting with ${lead.name} (${lead.company || 'Direct'}) starts in 1 hour.`,
              icon: '/vite.svg', // Default Vite icon, could be replaced with actual logo
              requireInteraction: true
            });
          } else {
            // Fallback to in-app toast
            addToast(`Upcoming meeting with ${lead.name} in 1 hour!`, 'info');
          }
          notifiedMeetings.current.add(lead._id);
        }
      }
    });
  }, [data, addToast]);
};

export default useMeetingAlerts;
