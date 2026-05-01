import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leadsApi } from '../api/leadsApi';
import { useToast } from '../context/ToastContext';
import { useSocket } from './useSocket';

/**
 * Manages meeting reminders for all roles.
 *
 * Priority 1 – socket events pushed by the server cron every 2 minutes:
 *   meeting:reminder_1h  → banner + browser notification
 *   meeting:reminder_15m → banner + browser notification + urgent toast
 *
 * Priority 2 – client-side polling fallback every 5 minutes:
 *   Catches the 1-hour window for executives if socket is unavailable.
 *
 * Returns { activeMeeting, dismissMeeting } for the caller to render
 * MeetingAlertBanner.
 */
export const useMeetingAlerts = () => {
  const { addToast } = useToast();
  const socket = useSocket();
  const notifiedPolling = useRef(new Set());
  const [activeMeeting, setActiveMeeting] = useState(null);

  // Request browser notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showBrowserNotification = useCallback((title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico', requireInteraction: true });
    }
  }, []);

  const dismissMeeting = useCallback(() => setActiveMeeting(null), []);

  // ── Socket-based reminders (server-pushed, most reliable) ───────────────
  useEffect(() => {
    if (!socket) return;

    const handle1h = (meeting) => {
      setActiveMeeting({ ...meeting, reminderType: '1h' });
      showBrowserNotification(
        `Meeting in 1 hour: ${meeting.lead}`,
        `${meeting.type === 'virtual' ? 'Virtual' : 'Direct'} meeting at ${new Date(meeting.meetingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      );
    };

    const handle15m = (meeting) => {
      setActiveMeeting({ ...meeting, reminderType: '15m' });
      showBrowserNotification(
        `Meeting in 15 min: ${meeting.lead}`,
        `${meeting.type === 'virtual' ? 'Join your virtual meeting now' : 'Head to the direct meeting location'}`
      );
      addToast(`⏰ Meeting with ${meeting.lead} in 15 minutes!`, 'warning');
    };

    socket.on('meeting:reminder_1h',  handle1h);
    socket.on('meeting:reminder_15m', handle15m);

    return () => {
      socket.off('meeting:reminder_1h',  handle1h);
      socket.off('meeting:reminder_15m', handle15m);
    };
  }, [socket, showBrowserNotification, addToast]);

  // ── Polling fallback: covers the 1-hour window for all roles ────────────
  const { data } = useQuery({
    queryKey: ['meeting-alerts-poll'],
    queryFn: () => leadsApi.getLeads({ status: 'meeting_virtual,meeting_direct', limit: 50 }).then(r => r.data),
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!data?.leads) return;
    const now = Date.now();

    data.leads.forEach(lead => {
      if (!lead.meetingAt) return;
      const diffMin = (new Date(lead.meetingAt).getTime() - now) / 60000;

      // 1-hour window: 50–65 min
      if (diffMin > 50 && diffMin <= 65 && !notifiedPolling.current.has(`${lead._id}-1h`)) {
        notifiedPolling.current.add(`${lead._id}-1h`);
        // Only show toast/browser notification if socket hasn't already shown the banner
        if (!activeMeeting) {
          showBrowserNotification(
            `Meeting in ~1 hour: ${lead.name}`,
            `${lead.company ? lead.company + ' · ' : ''}${new Date(lead.meetingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          );
          addToast(`Upcoming meeting with ${lead.company || lead.name} in ~1 hour.`, 'info');
        }
      }
    });
  }, [data, activeMeeting, showBrowserNotification, addToast]);

  return { activeMeeting, dismissMeeting };
};

export default useMeetingAlerts;
