import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Modal from '../ui/Modal';
import { Button } from '../ui';
import { usersApi } from '../../api/usersApi';
import { useToast } from '../../context/ToastContext';

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');
const EMPTY_FORM = { name: '', email: '', phone: '', password: '', confirmPassword: '' };

/**
 * Founder only. Adds another founder account. Every founder is an equal: same
 * dashboard, same data, same approval inbox — access is decided by role alone.
 */
const CreateFounderModal = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  const { data: founders = [] } = useQuery({
    queryKey: ['users', 'founders'],
    queryFn: () => usersApi.getUsers({ role: 'founder' }).then(r => r.data || []),
    enabled: isOpen,
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return addToast('Password must be at least 8 characters', 'warning');
    if (form.password !== form.confirmPassword) return addToast('Passwords do not match', 'warning');

    setLoading(true);
    try {
      const { name, email, phone, password } = form;
      await usersApi.createFounder({ name, email, phone, password });
      addToast(`${form.name} added as a founder`, 'success');
      qc.invalidateQueries({ queryKey: ['users'] });
      window.dispatchEvent(new CustomEvent('refresh-users'));
      handleClose();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error creating founder', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Add Founder"
      subtitle="The new founder sees the same dashboard and data as you"
      onClose={handleClose}
    >
      <div className="space-y-6">
        {founders.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-accent uppercase tracking-widest">Current Founders</div>
            <div className="border border-border rounded-xl divide-y divide-border/60">
              {founders.map(f => (
                <div key={f._id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-text-primary">{f.name}</span>
                  <span className="text-text-muted text-[12px] truncate">{f.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs font-bold text-accent uppercase tracking-widest">New Founder</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="form-label">Full Name</label>
              <input className="input" type="text" value={form.name} onChange={set('name')} placeholder="Full name" required />
            </div>
            <div className="space-y-1">
              <label className="form-label">Phone</label>
              <input className="input" type="tel" inputMode="numeric" pattern="[0-9]*" value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: digitsOnly(e.target.value) }))} placeholder="91 XXXXX XXXXX" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="form-label">Email (login)</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="founder@company.com" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="form-label">Password</label>
              <input className="input" type="password" value={form.password} onChange={set('password')}
                placeholder="At least 8 characters" autoComplete="new-password" required />
            </div>
            <div className="space-y-1">
              <label className="form-label">Confirm Password</label>
              <input className="input" type="password" value={form.confirmPassword} onChange={set('confirmPassword')}
                placeholder="Repeat password" autoComplete="new-password" required />
            </div>
          </div>
          <p className="text-[12px] text-text-muted">
            Share this password with the new founder; they can change it from their profile after logging in.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>Create Founder</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CreateFounderModal;
