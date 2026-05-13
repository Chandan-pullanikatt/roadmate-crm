import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { targetsApi } from '../../../api/targetsApi';
import { usersApi } from '../../../api/usersApi';

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

const Targets = () => {
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [assignForm, setAssignForm] = useState({ userId: '', calls: '', leads: '', conversions: '', revenue: '' });
  const [saving, setSaving] = useState(false);

  const { data: teamTargets = [] } = useQuery({
    queryKey: ['targets', 'team', month, year],
    queryFn: () => targetsApi.getTeamTargets({ month, year }).then(r => r.data),
    staleTime: 3 * 60 * 1000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => usersApi.getUsers().then(r => r.data || []),
    staleTime: 10 * 60 * 1000,
  });

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.userId) return;
    setSaving(true);
    try {
      await targetsApi.assignTarget({ ...assignForm, month, year });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      setAssignForm({ userId: '', calls: '', leads: '', conversions: '', revenue: '' });
    } finally {
      setSaving(false);
    }
  };

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <div className="section-header">
        <div>
          <div className="section-title">Targets &amp; Achievement</div>
          <div className="section-sub">Set monthly targets and track live progress across all roles</div>
        </div>
        {/* Month / Year selector */}
        <div className="flex items-center gap-2">
          <select className="select min-w-[110px]" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="select w-24" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Assign Target Form */}
      <div className="card">
        <div className="card-header border-b border-border bg-surface2/10">
          <div className="section-title text-sm">Assign Monthly Target</div>
        </div>
        <div className="p-6">
          <form onSubmit={handleAssign}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              <div className="col-span-2 md:col-span-3 lg:col-span-2 space-y-1">
                <label className="form-label">Staff Member</label>
                <select className="select" value={assignForm.userId} onChange={e => setAssignForm(f => ({ ...f, userId: e.target.value }))} required>
                  <option value="">Select Staff</option>
                  {allUsers.filter(u => u.role !== 'founder').map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.role?.replace(/_/g, ' ')})</option>
                  ))}
                </select>
              </div>
              {[['Calls', 'calls'], ['Leads', 'leads'], ['Conversions', 'conversions'], ['Revenue (₹)', 'revenue']].map(([label, key]) => (
                <div key={key} className="space-y-1">
                  <label className="form-label">{label}</label>
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
          <div className="section-title text-sm">Team Progress — {months[month - 1]} {year}</div>
          <span className="text-[11px] text-text-muted">{teamTargets.length} targets set</span>
        </div>

        {teamTargets.length === 0 ? (
          <div className="p-16 text-center text-text-muted italic">
            No targets set for {months[month - 1]} {year}. Use the form above to assign.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface2/30 border-b border-border text-[10px] font-black uppercase tracking-widest text-text-muted">
                  <th className="p-4">Staff</th>
                  <th className="p-4">Calls</th>
                  <th className="p-4">Leads</th>
                  <th className="p-4">Conversions</th>
                  <th className="p-4">Revenue</th>
                  <th className="p-4 text-center">Overall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teamTargets.map((t, idx) => {
                  const callsPct   = pct(t.achieved?.calls || 0,        t.calls || 0);
                  const leadsPct   = pct(t.achieved?.leads || 0,        t.leads || 0);
                  const convPct    = pct(t.achieved?.conversions || 0,  t.conversions || 0);
                  const revPct     = pct(t.achieved?.revenue || 0,      t.revenue || 0);
                  const overall    = Math.round((callsPct + leadsPct + convPct + revPct) / 4);

                  return (
                    <tr key={t._id || idx} className="hover:bg-surface2/20 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-[13px]">{t.user?.name || 'Unknown'}</div>
                        <div className="text-[10px] text-text-muted capitalize">{t.user?.role?.replace(/_/g, ' ') || ''}</div>
                      </td>
                      <td className="p-4 min-w-[160px]">
                        <div className="text-[10px] text-text-muted mb-1">{t.achieved?.calls || 0} / {t.calls || 0}</div>
                        <ProgressBar value={callsPct} color="#3B82F6" />
                      </td>
                      <td className="p-4 min-w-[160px]">
                        <div className="text-[10px] text-text-muted mb-1">{t.achieved?.leads || 0} / {t.leads || 0}</div>
                        <ProgressBar value={leadsPct} color="#7C3AED" />
                      </td>
                      <td className="p-4 min-w-[160px]">
                        <div className="text-[10px] text-text-muted mb-1">{t.achieved?.conversions || 0} / {t.conversions || 0}</div>
                        <ProgressBar value={convPct} color="#059669" />
                      </td>
                      <td className="p-4 min-w-[160px]">
                        <div className="text-[10px] text-text-muted mb-1">₹{(t.achieved?.revenue || 0).toLocaleString()} / ₹{(t.revenue || 0).toLocaleString()}</div>
                        <ProgressBar value={revPct} color="#0891B2" />
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="text-[22px] font-black font-mono" style={{ color: overall >= 100 ? '#059669' : overall >= 70 ? '#0f766e' : overall >= 40 ? '#D97706' : '#DC2626' }}>
                            {overall}%
                          </div>
                          <div className="text-[9px] font-bold text-text-muted uppercase tracking-widest">
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
