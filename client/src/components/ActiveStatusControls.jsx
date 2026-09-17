import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './ui';
import { usersApi } from '../api/usersApi';

// Active / Inactive switch for the founder's staff lists. Inactive staff are
// hidden from the default view, so this is how the founder finds them again.
export const ActiveFilter = ({ showInactive, onChange }) => (
  <div className="flex bg-surface2 p-1 rounded-xl border border-border gap-1">
    {[['Active', false], ['Inactive', true]].map(([label, val]) => (
      <button
        key={label}
        type="button"
        onClick={() => onChange(val)}
        className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${showInactive === val ? 'bg-white shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
      >
        {label}
      </button>
    ))}
  </div>
);

export const matchesActiveFilter = (user, showInactive) =>
  showInactive ? user?.isActive === false : user?.isActive !== false;

// Deactivate / Activate button (founder only; the server enforces this).
export const ActiveToggleButton = ({ user }) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!user?._id) return null;
  const active = user.isActive !== false;

  const handleClick = async () => {
    const prompt = active
      ? `Deactivate ${user.name}? They will be logged out and cannot sign in until reactivated. Their data is kept.`
      : `Reactivate ${user.name}? They will be able to sign in again.`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    try {
      await usersApi.setUserStatus(user._id, !active);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'founder'] });
      window.dispatchEvent(new CustomEvent('refresh-users'));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update account status');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="xs"
      variant="outline"
      disabled={busy}
      className={active
        ? 'bg-surface2 border-border text-text-secondary shadow-sm hover:bg-surface2/70 px-3 font-bold'
        : 'bg-[#0f766e]/5 border-[#0f766e]/30 text-[#0f766e] shadow-sm hover:bg-[#0f766e]/10 px-3 font-bold'}
      onClick={handleClick}
    >
      {active ? 'Deactivate' : 'Activate'}
    </Button>
  );
};
