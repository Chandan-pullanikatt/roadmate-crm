import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { targetsApi } from '../../../api/targetsApi';
import { usersApi } from '../../../api/usersApi';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { TARGET_METRICS, monthKey, currentPeriodKey, shiftWeek, periodLabel } from '../../../utils/targetPeriod';

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

const pct = (achieved, target) => {
  if (!target || target === 0) return 0;
  return Math.min(100, Math.round((achieved / target) * 100));
};

const ProgressBar = ({ value, color = '#0f766e' }) => (
  <div className="flex items-center gap-3">
    <div className="flex-1 h-2 bg-surface2 rounded-full overflow-hidden border border-border/50">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, background: value >= 100 ? '#059669' : value >= 70 ? color : value >= 40 ? '#D97706' : '#DC2626' }}
      />
    </div>
    <span className="text-[11px] font-black font-mono w-10 text-right" style={{ color: value >= 100 ? '#059669' : value >= 70 ? '#374151' : value >= 40 ? '#D97706' : '#DC2626' }}>
      {value}%
    </span>
  </div>
);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const EMPTY_FORM = { userId: '', directMeetings: '', blocking: '', conversions: '' };

const Targets = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const now = new Date();
  const [period, setPeriod] = useState('monthly');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [weekKey, setWeekKey] = useState(currentPeriodKey('weekly'));
  const [assignForm, setAssignForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const periodKey = period === 'weekly' ? weekKey : monthKey(year, month);
  const label = periodLabel(period, periodKey);
  const periodWord = period === 'weekly' ? 'Weekly' : 'Monthly';

  const { data: teamTargets = [] } = useQuery({
    queryKey: ['targets', 'team', period, periodKey],
    queryFn: () => targetsApi.getTeamTargets({ period, periodKey }).then(r => r.data),
    staleTime: 3 * 60 * 1000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => usersApi.getUsers().then(r => r.data || []),
    staleTime: 10 * 60 * 1000,
  });

  // Founders can target anyone; managers only the staff who report to them
  const isFounder = user?.role === 'founder';
  const staff = allUsers.filter(u => isFounder
    ? u.role !== 'founder'
    : String(u.reportingTo?._id || u.reportingTo) === String(user?._id));

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.userId) return;
    setSaving(true);
    try {
      await targetsApi.assignTarget({ ...assignForm, period, periodKey });
      addToast(`${periodWord} target saved for ${label}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      setAssignForm(EMPTY_FORM);
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
          <div className="section-title">Targets &amp; Achievement</div>
          <div className="section-sub">Set monthly or weekly targets for yourself{isFounder ? ' and any staff member' : ' and your team'}, and track live progress</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Period type */}
          <div className="flex rounded-xl border border-border overflow-hidden">
            {['monthly', 'weekly'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-[14px] font-bold capitalize transition-colors ${period === p ? 'bg-[#0f766e] text-white' : 'bg-white text-text-secondary hover:bg-surface2'}`}
              >
                {p}
              </button>
            ))}
          </div>

          {period === 'monthly' ? (
            <>
              <select className="select min-w-[110px]" value={month} onChange={e => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select className="select w-24" value={year} onChange={e => setYear(Number(e.target.value))}>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          ) : (
            <div className="flex items-center gap-1">
              <button type="button" className="btn btn-outline px-3" onClick={() => setWeekKey(k => shiftWeek(k, -1))} aria-label="Previous week">‹</button>
              <div className="px-3 text-[13px] font-bold whitespace-nowrap min-w-[170px] text-center">{label}</div>
              <button type="button" className="btn btn-outline px-3" onClick={() => setWeekKey(k => shiftWeek(k, 1))} aria-label="Next week">›</button>
              {weekKey !== currentPeriodKey('weekly') && (
                <button type="button" className="text-[11px] font-bold text-[#0f766e] ml-1" onClick={() => setWeekKey(currentPeriodKey('weekly'))}>This week</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assign Target Form */}
      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10">
          <div className="section-title text-sm">Assign {periodWord} Target — {label}</div>
        </div>
        <div className="p-6">
          <form onSubmit={handleAssign}>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
              <div className="sm:col-span-3 lg:col-span-2 space-y-1">
                <label className="form-label">Staff Member</label>
                <select className="select" value={assignForm.userId} onChange={e => setAssignForm(f => ({ ...f, userId: e.target.value }))} required>
                  <option value="">Select Staff</option>
                  {user?._id && <option value={user._id}>Myself ({user.name})</option>}
                  {staff.map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.role?.replace(/_/g, ' ')})</option>
                  ))}
                </select>
              </div>
              {TARGET_METRICS.map(({ key, label: metricLabel }) => (
                <div key={key} className="space-y-1">
                  <label className="form-label">{metricLabel}</label>
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*" className="input"
                    placeholder="0"
                    value={assignForm[key]}
                    onChange={e => setAssignForm(f => ({ ...f, [key]: digitsOnly(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="btn btn-primary bg-[#0f766e] border-[#0f766e] px-8" disabled={saving || !assignForm.userId}>
              {saving ? 'Saving...' : 'Assign Target'}
            </button>
          </form>
        </div>
      </div>

      {/* Team Targets Table */}
      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10">
          <div className="section-title text-sm">Team Progress — {label}</div>
          <span className="text-[13px] text-text-muted">{teamTargets.length} targets set</span>
        </div>

        {teamTargets.length === 0 ? (
          <div className="p-16 text-center text-text-muted italic">
            No {period} targets set for {label}{isFounder ? ' by anyone' : ' in your team'}. Use the form above to assign.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface2/30 border-b border-border text-[12px] font-black uppercase tracking-widest text-text-muted">
                  <th className="p-4">Staff</th>
                  <th className="p-4">Set By</th>
                  {TARGET_METRICS.map(m => <th key={m.key} className="p-4">{m.label}</th>)}
                  <th className="p-4 text-center">Overall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teamTargets.map((t, idx) => {
                  const percents = TARGET_METRICS.map(m => pct(t.achieved?.[m.key] || 0, t[m.key] || 0));
                  const overall = Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);

                  return (
                    <tr key={t._id || idx} className="hover:bg-surface2/20 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-[13px]">{t.user?.name || 'Unknown'}{t.user?._id === user?._id && ' (You)'}</div>
                        <div className="text-[12px] text-text-muted capitalize">{t.user?.role?.replace(/_/g, ' ') || ''}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-[13px] font-semibold">
                          {t.assignedBy?._id === user?._id ? 'You' : (t.assignedBy?.name || '—')}
                        </div>
                        <div className="text-[12px] text-text-muted capitalize">{t.assignedBy?.role?.replace(/_/g, ' ') || ''}</div>
                      </td>
                      {TARGET_METRICS.map((m, i) => (
                        <td key={m.key} className="p-4 min-w-[160px]">
                          <div className="text-[12px] text-text-muted mb-1">{t.achieved?.[m.key] || 0} / {t[m.key] || 0}</div>
                          <ProgressBar value={percents[i]} color={m.color} />
                        </td>
                      ))}
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="text-[22px] font-black font-mono" style={{ color: overall >= 100 ? '#059669' : overall >= 70 ? '#0f766e' : overall >= 40 ? '#D97706' : '#DC2626' }}>
                            {overall}%
                          </div>
                          <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest">
                            {overall >= 100 ? '🏆 On Target' : overall >= 70 ? '✅ Good' : overall >= 40 ? '⚠️ At Risk' : '🔴 Critical'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Targets;
