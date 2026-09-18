import React from 'react';

/** Lead statuses at which money is received and must be entered. */
export const AMOUNT_STAGES = new Set(['blocking_amount_received', 'full_amount_received']);

const STAGE_LABELS = {
  blocking_amount_received: 'Blocking amount received (₹) *',
  full_amount_received: 'Amount received now (₹) *',
};

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** Parses the typed amount; 0 when blank or invalid. */
export const parseAmount = (value) => Number(String(value ?? '').replace(/\D/g, '')) || 0;

/**
 * Amount entered when a lead reaches Blocking or Full Amount Received. This is
 * the figure every revenue page adds up, so it is the money collected at this
 * step only — the balance for Full Amount, not the whole deal value again.
 */
const PaymentAmountField = ({ stage, value, onChange, lead, labelClassName = 'form-label', inputClassName = 'input' }) => {
  if (!AMOUNT_STAGES.has(stage)) return null;

  const received = (lead?.blockingAmount || 0) + (lead?.fullAmount || 0);
  const entered = parseAmount(value);

  return (
    <div className="space-y-1">
      <label className={labelClassName}>{STAGE_LABELS[stage]}</label>
      <input
        type="text"
        inputMode="numeric"
        className={inputClassName}
        placeholder="e.g. 25000"
        value={value}
        onChange={(e) => onChange(String(e.target.value).replace(/\D/g, ''))}
      />
      <p className="text-[13px] text-text-muted">
        {stage === 'full_amount_received'
          ? 'Enter only what was collected now (the balance), not the full deal value again.'
          : 'Enter the advance collected.'}
        {received > 0 && ` Already received: ${rupees(received)}.`}
        {entered > 0 && received > 0 && ` Total after this: ${rupees(received + entered)}.`}
      </p>
    </div>
  );
};

export default PaymentAmountField;
