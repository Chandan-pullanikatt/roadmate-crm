import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notificationsApi';

const ICONS = {
  broadcast: '📣',
  document_uploaded: '📄',
  lead_allocated: '👥',
  lead_added: '👥',
  leave_approved: '📅',
  leave_rejected: '📅',
  staff_created: '🤝',
};

const TITLES = {
  broadcast: 'Message',
  document_uploaded: 'New document',
  lead_allocated: 'Lead assigned',
  lead_added: 'New lead',
  leave_approved: 'Leave approved',
  leave_rejected: 'Leave rejected',
  staff_created: 'New team member',
};

const formatTime = (d) =>
  d ? new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Must-read popup. Whenever the user has unread notifications it covers the
 * CRM and can't be dismissed until they acknowledge them — on opening the
 * dashboard, and live when a new one arrives (NotificationListener refreshes
 * the 'notifications' queries on every socket push).
 */
const UnreadNotificationsGate = () => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationsApi.getNotifications({ unread: true, limit: 100 }).then((res) => res.data),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const unread = data?.notifications || [];
  if (!unread.length) return null;

  const handleAcknowledge = async () => {
    setSaving(true);
    setError('');
    try {
      // Only the ones shown — anything that arrived meanwhile pops up next.
      await notificationsApi.markAllRead(unread.map((n) => n._id));
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const hiddenCount = (data?.unreadCount || 0) - unread.length;

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unread-gate-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-border">
          <h2 id="unread-gate-title" className="text-lg font-bold text-text-primary">
            🔔 You have {data.unreadCount} new notification{data.unreadCount === 1 ? '' : 's'}
          </h2>
          <p className="text-xs text-text-muted mt-1">Please read these before continuing.</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {unread.map((n) => (
            <div key={n._id} className="p-4 border-b border-border last:border-0 flex gap-3">
              <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                {ICONS[n.type] || '🔔'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  {n.type === 'broadcast' && n.meta?.senderName
                    ? `Message from ${n.meta.senderRole === 'founder' ? 'Founder' : n.meta.senderName}`
                    : (TITLES[n.type] || 'Notification')}
                </div>
                <div className="text-sm text-text-primary mt-0.5 whitespace-pre-wrap break-words">{n.message}</div>
                <div className="text-[11px] text-text-muted mt-1">{formatTime(n.createdAt)}</div>
              </div>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="p-3 text-center text-[11px] text-text-muted">
              + {hiddenCount} older — they'll show after these.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border">
          {error && <div className="text-xs text-red mb-2">{error}</div>}
          <button
            onClick={handleAcknowledge}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[#0f766e] text-white font-bold text-sm hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : "I've read these"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnreadNotificationsGate;
