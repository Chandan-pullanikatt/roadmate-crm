import React from 'react';

/**
 * "Fixed date" for a follow-up: a fixed follow-up keeps its date even if the
 * person is on leave; other follow-ups move forward with leave and pending work.
 */
const FixedFollowUpToggle = ({ checked, onChange }) => (
  <label className="flex items-start gap-2.5 cursor-pointer select-none">
    <input
      type="checkbox"
      className="w-4 h-4 mt-0.5 rounded accent-[#0f766e] cursor-pointer"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
    />
    <span>
      <span className="block text-[13px] font-bold text-text-primary">📌 Fixed date</span>
      <span className="block text-[12px] text-text-muted">Keep this date even if I'm on leave (e.g. the customer asked for this day).</span>
    </span>
  </label>
);

export default FixedFollowUpToggle;
