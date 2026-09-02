import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Button } from '../ui';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { notificationsApi } from '../../api/notificationsApi';

const MAX_LENGTH = 500;

/**
 * Founder or manager sends a message to their team.
 * Recipients are resolved on the server from the reporting hierarchy — a
 * manager can only ever reach their own downline, never a peer's staff.
 */
const AUDIENCES = {
  founder: [
    { value: '', label: 'Everyone' },
    { value: 'state_manager', label: 'State Managers' },
    { value: 'industry_manager', label: 'Industry Managers' },
    { value: 'executive', label: 'District Executives' },
  ],
  state_manager: [
    { value: '', label: 'My whole team' },
    { value: 'industry_manager', label: 'My Industry Managers' },
    { value: 'executive', label: 'My District Executives' },
  ],
  industry_manager: [
    { value: '', label: 'My whole team' },
    { value: 'executive', label: 'My District Executives' },
  ],
};

const SendNotificationModal = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('');
  const [sending, setSending] = useState(false);

  const options = AUDIENCES[user?.role] || [];

  const handleClose = () => {
    if (sending) return;
    setMessage('');
    setAudience('');
    onClose();
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text) return addToast('Please type a message.', 'warning');

    setSending(true);
    try {
      const { data } = await notificationsApi.broadcast({
        message: text,
        role: audience || undefined,
      });
      addToast(data.message || 'Notification sent.', 'success');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setMessage('');
      setAudience('');
      onClose();
    } catch (err) {
      addToast(err?.response?.data?.message || 'Could not send the notification.', 'error');
    } finally {
      setSending(false);
    }
  };

  if (!options.length) return null;

  return (
    <Modal
      isOpen={isOpen}
      title="Send Notification"
      subtitle="Everyone you select sees this on their dashboard"
      onClose={handleClose}
      className="max-w-lg"
    >
      <div className="space-y-5">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
            Send to
          </label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            disabled={sending}
            className="w-full bg-white border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-blue disabled:opacity-60"
          >
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
            disabled={sending}
            rows={5}
            placeholder="e.g. Team meeting tomorrow at 10 AM. Please update all pending follow-ups before then."
            className="w-full bg-white border border-border rounded-xl px-4 py-3 text-sm text-text-primary outline-none focus:border-blue resize-none disabled:opacity-60"
          />
          <div className="text-[10px] font-bold text-text-muted text-right mt-1">
            {message.length}/{MAX_LENGTH}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" className="bg-white" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            className="bg-[#0f766e] text-white border-none"
            onClick={handleSend}
            disabled={sending || !message.trim()}
          >
            {sending ? 'Sending…' : 'Send Notification'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SendNotificationModal;
