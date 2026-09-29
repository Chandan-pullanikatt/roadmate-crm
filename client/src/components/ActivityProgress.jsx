import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '../api/axios';
import { usePeriod, PeriodPicker } from './LeadPipelinePanel';

/**
 * The Team Performance Leaderboard's activity columns for one person. Figures
 * come from /stats/user/:id/performance -- the same performanceService row the
 * leaderboard renders -- so this card and the person's line in any manager's
 * table always read the same numbers for the same period.
 */
export const ACTIVITY_METRICS = [
  { key: 'calls', label: 'Calls', color: '#8B5CF6' },
  { key: 'directMeetings', label: 'Direct Meetings', color: '#0EA5E9' },
  { key: 'virtualMeetings', label: 'Virtual Meetings', color: '#06B6D4' },
  { key: 'blocking', label: 'Blockings', color: '#F59E0B' },
];

const periodText = (period, value) => value || (period === 'yesterday' ? 'Yesterday' : 'Today');

/** A user's leaderboard metrics for a period. */
export const useUserPerformance = (userId, period, value) => useQuery({
  queryKey: ['stats', 'user-performance', userId, period, value],
  queryFn: () => api.get(`/stats/user/${userId}/performance`, {
    params: { period, value: value || undefined }
  }).then(res => res.data),
  enabled: !!userId,
  placeholderData: keepPreviousData,
});

const ActivityProgress = ({ userId }) => {
  const picker = usePeriod('month');
  const { data: metrics = {}, isLoading } = useUserPerformance(userId, picker.period, picker.value);

  // No per-metric targets exist for all four, so each bar is scaled against the
  // largest figure in the period -- a relative picture, not progress to a goal.
  const max = Math.max(1, ...ACTIVITY_METRICS.map(m => metrics[m.key] || 0));

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm p-6 flex flex-col min-w-0">
      <div className="flex flex-col gap-3 mb-6">
        <div>
          <h3 className="text-[16px] font-bold text-text-primary mb-1 flex items-center gap-2">
            <span className="text-green">🎯</span> Activity Progress
          </h3>
          <p className="text-[14px] text-text-muted">
            Your lead actions · {periodText(picker.period, picker.value)}
          </p>
        </div>
        <PeriodPicker {...picker} compact />
      </div>

      <div className="space-y-5">
        {ACTIVITY_METRICS.map(({ key, label, color }) => {
          const value = metrics[key] || 0;
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[12px] font-bold text-text-primary">{label}</span>
                <span className="text-[12px] font-black" style={{ color }}>{isLoading ? '–' : value}</span>
              </div>
              <div className="h-2 bg-surface2 rounded-full overflow-hidden border border-border/50">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.round((value / max) * 100)}%`, backgroundColor: color }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityProgress;
