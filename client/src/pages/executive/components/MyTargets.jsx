import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { targetsApi } from '../../../api/targetsApi';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { TARGET_METRICS, currentPeriodKey, periodLabel } from '../../../utils/targetPeriod';
import ConfirmTargetModal from '../../../components/modals/ConfirmTargetModal';
import { TargetSection } from './Performance';

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');
const EMPTY_FORM = { directMeetings: '', blocking: '', conversions: '' };

/**
 * A District Manager's own targets: set a goal for the current month or week,
 * then track it. Assignment is self-only — the server refuses any other userId
 * from this role — so there is no staff picker.
 */
const MyTargets = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user } = useAuth();

  const [period, setPeriod] = useState('monthly');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const periodKey = currentPeriodKey(period);
  const label = periodLabel(period, periodKey);
  const periodWord = period === 'weekly' ? 'Weekly' : 'Monthly';

  // The target already in place for this period. One per period is the rule, so
  // this decides whether the form is offered at all.
  const { data: existing } = useQuery({
    queryKey: ['targets', 'my', period, periodKey],
    queryFn: () => targetsApi.getMyTargets({ period, periodKey }).then(res => res.data),
    staleTime: 60 * 1000,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setConfirming(true);
  };

  const confirmSave = async () => {
    setSaving(true);
    try {
      await targetsApi.assignTarget({ ...form, userId: user?._id, period, periodKey });
      addToast(`${periodWord} target saved for ${label}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      setForm(EMPTY_FORM);
      setConfirming(false);
    } catch (err) {
      addToast(err.response?.data?.message || 'Could not save the target', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <div className="section-header flex-wrap gap-3">
        <div>
          <div className="section-title">My Targets</div>
          <div className="section-sub">Set your own monthly or weekly goal and track it as you work</div>
        </div>
      </div>

      <div className="card">
        {/* The period picker sits outside the form on purpose: with this month
            already targeted, this is how you reach the week that is not. */}
        <div className="card-header border-b border-border bg-surface2/10 flex-wrap gap-3">
          <div className="section-title text-sm">Set My {periodWord} Target — {label}</div>
          <select
            className="select w-auto min-w-[150px]"
            value={period}
            onChange={e => { setPeriod(e.target.value); setForm(EMPTY_FORM); }}
          >
            <option value="monthly">This month</option>
            <option value="weekly">This week</option>
          </select>
        </div>
        {existing?._id ? (
          <div className="p-6 text-[14px] text-text-secondary">
            Your {periodWord.toLowerCase()} target for {label} is already set
            {existing.assignedBy?.name ? ` by ${existing.assignedBy.name}` : ''}. A target cannot be replaced
            once it is in place — ask the founder to delete it if it has to change, and you can set a new one
            straight after.
          </div>
        ) : (
        <div className="p-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              {TARGET_METRICS.map(({ key, label: metricLabel }) => (
                <div key={key} className="space-y-1">
                  <label className="form-label">{metricLabel}</label>
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*" className="input"
                    placeholder="0"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: digitsOnly(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="btn btn-primary bg-[#0f766e] border-[#0f766e] px-8" disabled={saving}>
              {saving ? 'Saving...' : 'Set My Target'}
            </button>
          </form>
        </div>
        )}
      </div>

      <TargetSection filterable />

      <ConfirmTargetModal
        isOpen={confirming}
        staffName={`${user?.name || 'you'} (Myself)`}
        period={period}
        periodKey={periodKey}
        values={form}
        loading={saving}
        onConfirm={confirmSave}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
};

export default MyTargets;
