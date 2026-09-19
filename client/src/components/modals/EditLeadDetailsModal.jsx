import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Button } from '../ui';
import { useToast } from '../../context/ToastContext';
import { leadsApi } from '../../api/leadsApi';
import LocationSelector from '../common/LocationSelector';
import { PHONE_CODES, dialCodeFor } from '../../data/phoneCodes';

/**
 * Edits a lead's contact details (name, company, phone, email, location).
 * Managers and the founder only — the server enforces that and the team scope.
 * Status, follow-ups and payments stay on the Update Lead modal.
 */

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

// Splits a stored "+919876543210" back into the country picker and the number.
// A bare 10-digit number (older or imported leads) is treated as Indian.
const splitPhone = (phone) => {
  const raw = String(phone || '').replace(/[\s-]/g, '');
  if (!raw.startsWith('+')) return { phoneCountry: 'IN', phone: digitsOnly(raw).slice(-10) };
  if (raw.startsWith('+91')) return { phoneCountry: 'IN', phone: raw.slice(3) };
  const match = [...PHONE_CODES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find(c => raw.startsWith(c.dialCode));
  return match
    ? { phoneCountry: match.iso, phone: raw.slice(match.dialCode.length) }
    : { phoneCountry: 'IN', phone: digitsOnly(raw) };
};

const toForm = (lead) => ({
  name: lead?.name || '',
  company: lead?.company || '',
  ...splitPhone(lead?.phone),
  email: lead?.email || '',
  // Imported leads often carry a state but no country; the picker needs both.
  country: lead?.country || (lead?.state ? 'India' : ''),
  state: lead?.state || '',
  district: lead?.district || '',
  regionType: lead?.regionType || '',
  region: lead?.region || '',
});

const EditLeadDetailsModal = ({ isOpen, onClose, lead }) => {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => toForm(lead));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(toForm(lead));
  }, [isOpen, lead]);

  if (!lead) return null;

  const set = (patch) => setForm(prev => ({ ...prev, ...patch }));
  const isIndian = form.phoneCountry === 'IN';

  const save = async (confirmDuplicate = false) => {
    setSaving(true);
    try {
      const { phoneCountry, phone, ...rest } = form;
      await leadsApi.updateLeadDetails(lead._id, {
        ...rest,
        phone: `${dialCodeFor(phoneCountry)}${phone}`,
        ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
      });
      addToast('Lead details updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead._id] });
      queryClient.invalidateQueries({ queryKey: ['lead-activity', lead._id] });
      onClose();
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 409 && data?.duplicate) {
        const e = data.existing || {};
        const ok = window.confirm(
          `${data.message}\n\n${e.name || ''}${e.company ? ` (${e.company})` : ''} · ${e.phone} · owner: ${e.owner}\n\nSave anyway?`
        );
        if (ok) return save(true);
      } else {
        addToast(data?.message || 'Error updating lead details', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isIndian ? !/^[6-9]\d{9}$/.test(form.phone) : form.phone.length < 7) {
      addToast('Enter a valid mobile number', 'error');
      return;
    }
    save();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Lead Details: ${lead.leadId || lead.name}`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="form-label">Full Name</label>
            <input className="input" type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Lead name" />
          </div>
          <div className="space-y-1">
            <label className="form-label">Company</label>
            <input className="input" type="text" value={form.company} onChange={(e) => set({ company: e.target.value })} placeholder="Company name" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="form-label">Phone Number <span className="text-red">*</span></label>
            <div className="flex gap-3">
              <select className="select w-44 shrink-0" value={form.phoneCountry} onChange={(e) => set({ phoneCountry: e.target.value })}>
                {PHONE_CODES.map(c => (
                  <option key={c.iso} value={c.iso}>{c.name} ({c.dialCode})</option>
                ))}
              </select>
              <input
                className="input flex-1"
                type="tel"
                inputMode="numeric"
                maxLength={isIndian ? 10 : 15}
                value={form.phone}
                onChange={(e) => set({ phone: digitsOnly(e.target.value).slice(0, isIndian ? 10 : 15) })}
                placeholder="XXXXX XXXXX"
                required
              />
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="form-label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="email@example.com" />
          </div>
        </div>

        <LocationSelector
          value={{
            country: form.country,
            state: form.state,
            district: form.district,
            regionType: form.regionType,
            region: form.region,
          }}
          onChange={(loc) => set({
            country: loc.country,
            state: loc.state,
            district: loc.district,
            regionType: loc.regionType,
            region: loc.region,
          })}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" className="bg-white" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="bg-[#0f766e] text-white border-none" disabled={saving}>
            {saving ? 'Saving…' : 'Save Details'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditLeadDetailsModal;
