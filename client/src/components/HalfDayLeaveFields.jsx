/**
 * "Half day" option for the apply-leave forms. A half-day leave is one session
 * (first or second half) of a single day, so turning it on pins To Date to
 * From Date. Works on any form state holding fromDate / toDate / isHalfDay /
 * halfDaySession.
 */
const SESSIONS = [
  { value: 'first_half', label: 'First half' },
  { value: 'second_half', label: 'Second half' },
];

export const HALF_DAY_DEFAULTS = { isHalfDay: false, halfDaySession: 'first_half' };

/** The request body fields a leave form sends, with To Date pinned for a half day. */
export const halfDayPayload = (form) => (
  form.isHalfDay
    ? { toDate: form.fromDate, isHalfDay: true, halfDaySession: form.halfDaySession || 'first_half' }
    : { isHalfDay: false }
);

/** "0.5 day (first half)" / "3 days" for a leave record. */
export const leaveDurationLabel = (leave) => {
  if (leave?.isHalfDay) {
    return `Half day (${leave.halfDaySession === 'second_half' ? 'second' : 'first'} half)`;
  }
  const days = leave?.days ?? 0;
  return `${days} day${days === 1 ? '' : 's'}`;
};

export default function HalfDayLeaveFields({ form, setForm }) {
  const toggle = (checked) => setForm({
    ...form,
    isHalfDay: checked,
    halfDaySession: form.halfDaySession || 'first_half',
    toDate: checked ? form.fromDate : form.toDate,
  });

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[13px] font-bold text-text-primary cursor-pointer select-none">
        <input
          type="checkbox"
          className="w-4 h-4 accent-current"
          checked={!!form.isHalfDay}
          onChange={(e) => toggle(e.target.checked)}
        />
        Half day leave
      </label>
      {form.isHalfDay && (
        <div className="flex gap-2">
          {SESSIONS.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => setForm({ ...form, halfDaySession: s.value })}
              className={`flex-1 px-3 py-2 rounded-lg border text-[12px] font-bold transition-colors ${
                form.halfDaySession === s.value
                  ? 'bg-text-primary text-white border-text-primary'
                  : 'bg-surface2 text-text-muted border-border'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
