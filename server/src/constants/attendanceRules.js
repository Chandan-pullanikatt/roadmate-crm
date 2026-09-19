/**
 * Auto-attendance rules (client spec, Sep 2026). The founder can change each
 * number from the Working Hours settings; these are the defaults.
 *
 *   Login   10–29 min late  → Late Coming (a mark, no pay effect)
 *           30+ min late    → Half Day
 *   Exit    15–59 min early → Early Exit (a mark, no pay effect)
 *           60+ min early   → Half Day
 *   Work    below 30%       → Leave
 *           30–59%          → Half Day
 *
 * The keys are new on purpose: settings saved under the old keys
 * (halfDayThreshold 70, earlyExitThresholdMinutes 120, a 30-min grace period)
 * must not override this spec.
 */
const DEFAULT_ATTENDANCE_RULES = {
  leaveBelowPct: 30,
  halfDayBelowPct: 60,
  lateMarkMinutes: 10,
  lateHalfDayMinutes: 30,
  earlyMarkMinutes: 15,
  earlyHalfDayMinutes: 60,
};

const DEFAULT_WORKING_HOURS = {
  normalStart: '09:30',
  normalEnd: '18:30',
  ramadanStart: '09:00',
  ramadanEnd: '17:30',
  ramadanFrom: null,
  ramadanTo: null,
  rules: DEFAULT_ATTENDANCE_RULES,
};

/** The saved rules, with any missing or non-numeric value taken from the defaults. */
const resolveAttendanceRules = (saved = {}) => {
  const rules = { ...DEFAULT_ATTENDANCE_RULES };
  for (const key of Object.keys(rules)) {
    const n = Number(saved?.[key]);
    if (saved?.[key] !== undefined && saved?.[key] !== '' && Number.isFinite(n)) rules[key] = n;
  }
  return rules;
};

module.exports = { DEFAULT_ATTENDANCE_RULES, DEFAULT_WORKING_HOURS, resolveAttendanceRules };
