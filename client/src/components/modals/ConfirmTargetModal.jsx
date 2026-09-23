import React from 'react';
import { Modal, Button } from '../ui';
import { TARGET_METRICS, periodLabel } from '../../utils/targetPeriod';

/**
 * Review-and-confirm step for assigning a target.
 *
 * /api/targets/assign upserts, so saving over a period that already has a
 * target replaces it silently. `existing` is that target when the caller knows
 * it (the Targets page has the team list in hand); left undefined the modal
 * only warns that a replacement is possible.
 */
const ConfirmTargetModal = ({
  isOpen,
  staffName,
  period = 'monthly',
  periodKey,
  values = {},
  existing,
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
              {existing && <th className="p-3 text-center">Current</th>}
              <th className="p-3 text-center">New</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {TARGET_METRICS.map(m => {
              const next = num(values[m.key]);
              const prev = existing ? num(existing[m.key]) : null;
              const changed = existing && prev !== next;
              return (
                <tr key={m.key}>
                  <td className="p-3 text-[13px] font-bold">{m.label}</td>
                  {existing && (
                    <td className="p-3 text-center text-[13px] font-mono text-text-muted">{prev}</td>
                  )}
                  <td
                    className="p-3 text-center text-[15px] font-black font-mono"
                    style={{ color: changed ? m.color : '#374151' }}
                  >
                    {next}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {existing ? (
          <div className="rounded-xl border border-orange/30 bg-orange/5 p-3 text-[13px] text-text-secondary">
            This replaces the target already set for {label}
            {existing.assignedBy?.name ? ` by ${existing.assignedBy.name}` : ''}.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface2/20 p-3 text-[13px] text-text-muted">
            Any target already set for {label} will be replaced.
          </div>
        )}

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
