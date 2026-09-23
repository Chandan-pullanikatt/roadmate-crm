import React from 'react';
import { Modal, Button } from '../ui';
import { TARGET_METRICS, periodLabel } from '../../utils/targetPeriod';

/**
 * Review-and-confirm step for setting a target.
 *
 * A target is final once saved: /api/targets/assign refuses a second one for
 * the same person and period, and only the founder can delete it. So this is
 * the last chance to change the numbers, and it says so.
 */
const ConfirmTargetModal = ({
  isOpen,
  staffName,
  period = 'monthly',
  periodKey,
  values = {},
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const periodWord = period === 'weekly' ? 'Weekly' : 'Monthly';
  const label = periodLabel(period, periodKey);
  const num = (v) => Math.max(0, parseInt(v, 10) || 0);
  const allZero = TARGET_METRICS.every(m => num(values[m.key]) === 0);

  return (
    <Modal
      isOpen={isOpen}
      title="Confirm Target"
      subtitle={`${periodWord} target for ${staffName || 'this staff member'} — ${label}`}
      onClose={onCancel}
      className="max-w-lg"
    >
      <div className="space-y-6">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface2/30 border-b border-border text-[12px] font-black uppercase tracking-widest text-text-muted">
              <th className="p-3">Metric</th>
              <th className="p-3 text-center">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {TARGET_METRICS.map(m => (
              <tr key={m.key}>
                <td className="p-3 text-[13px] font-bold">{m.label}</td>
                <td className="p-3 text-center text-[15px] font-black font-mono" style={{ color: m.color }}>
                  {num(values[m.key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="rounded-xl border border-orange/30 bg-orange/5 p-3 text-[13px] text-text-secondary">
          <span className="font-bold">This cannot be edited afterwards.</span> Only one target may be set
          for {label}. To change it later, the founder has to delete it first.
        </div>

        {allZero && (
          <div className="rounded-xl border border-red/30 bg-red/5 p-3 text-[13px] font-semibold text-red">
            Every metric is 0 — this staff member will have no target to work towards.
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Go Back</Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={loading}
            className="bg-[#0f766e] border-[#0f766e]"
          >
            Confirm &amp; Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmTargetModal;
