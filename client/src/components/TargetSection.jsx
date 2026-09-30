import React, { useState } from 'react';
import { useQueries, keepPreviousData } from '@tanstack/react-query';
import { targetsApi } from '../api/targetsApi';
import { TARGET_METRICS, currentPeriodKey, periodLabel, shiftWeek } from '../utils/targetPeriod';

// Monthly keys for the last 12 months and weekly keys for the last 12 weeks, newest first.
const recentTargetKeys = (period) => {
  const keys = [currentPeriodKey(period)];
  for (let i = 1; i < 12; i++) {
    if (period === 'weekly') {
      keys.push(shiftWeek(keys[i - 1], -1));
    } else {
      const [y, m] = keys[i - 1].split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  }
  return keys;
};

/**
 * Target vs achievement for the current month and week. With `filterable`, each
 * period gets a picker to look back at earlier months and weeks.
 */
export const TargetSection = ({ filterable = false }) => {
  const [selectedKeys, setSelectedKeys] = useState(() => ({
    monthly: currentPeriodKey('monthly'),
    weekly: currentPeriodKey('weekly')
  }));
  const periods = ['monthly', 'weekly'].map(period => ({ period, periodKey: selectedKeys[period] }));
  const results = useQueries({
    queries: periods.map(({ period, periodKey }) => ({
      queryKey: ['targets', 'my', period, periodKey],
      queryFn: () => targetsApi.getMyTargets({ period, periodKey }).then(res => res.data),
      placeholderData: keepPreviousData
    }))
  });

  if (results.some(r => r.isLoading)) return null;

  return (
    <div className="mt-8 bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-8">
      <div>
        <h2 className="text-lg font-black tracking-tight">Target vs Achievement</h2>
        <p className="text-xs text-muted">Monthly and weekly progress against the targets set for you</p>
      </div>

      {periods.map(({ period, periodKey }, idx) => {
        const target = results[idx].data || {};
        return (
          <div key={period} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-sm font-extrabold">
                {periodKey === currentPeriodKey(period)
                  ? (period === 'weekly' ? 'This Week' : 'This Month')
                  : (period === 'weekly' ? 'Week' : 'Month')}
              </div>
              {filterable ? (
                <select
                  value={periodKey}
                  onChange={(e) => setSelectedKeys(prev => ({ ...prev, [period]: e.target.value }))}
                  className="bg-white border border-border rounded-xl px-3 py-1.5 text-[13px] font-bold text-text-secondary outline-none focus:border-blue shadow-sm"
                >
                  {recentTargetKeys(period).map(key => (
                    <option key={key} value={key}>{periodLabel(period, key)}</option>
                  ))}
                </select>
              ) : (
                <div className="text-[10px] font-black px-3 py-1 bg-surface2 rounded-full uppercase tracking-widest border border-border">
                  {periodLabel(period, periodKey)}
                </div>
              )}
            </div>
            {!target._id ? (
              <div className="text-xs text-muted italic">No {period} target set for this {period === 'weekly' ? 'week' : 'month'}.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {TARGET_METRICS.map(({ key, label }) => {
                  const current = target.achieved?.[key] || 0;
                  const goal = target[key] || 0;
                  const pct = goal > 0 ? Math.round((current / goal) * 100) : 0;
                  return (
                    <div key={key} className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <div className="text-[10px] font-black text-muted uppercase tracking-wider mb-1">{label}</div>
                          <div className="text-xl font-black">{current} <span className="text-xs font-bold text-muted">/ {goal || '--'}</span></div>
                        </div>
                        <div className={`text-xs font-black ${pct >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                          {pct}%
                        </div>
                      </div>
                      <div className="h-2 w-full bg-surface2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${pct >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TargetSection;
