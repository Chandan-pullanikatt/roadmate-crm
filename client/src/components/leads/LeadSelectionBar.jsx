import React from 'react';
import { Button } from '../ui';

/**
 * The bar that appears above a lead table once rows are ticked, offering the bulk
 * actions for the caller's own place in the reporting tree: allocate down, or
 * escalate up. Shared by every dashboard's lead list so the wording, the counts
 * and the modal types cannot drift apart between the four of them.
 *
 * Which buttons show is the role rule the single-row actions already follow: a
 * District Manager has nobody below them so they never allocate, and the Founder
 * has nobody above them so they never escalate.
 */
const LeadSelectionBar = ({
  count,
  onAllocate,
  onEscalate,
  onClear,
  canAllocate = true,
  canEscalate = true,
}) => {
  if (!count) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl border border-[#0f766e]/20 bg-[#0f766e]/5">
      <div className="text-[13px] font-bold text-text-primary">
        {count} lead{count === 1 ? '' : 's'} selected
        <span className="ml-2 font-medium text-text-muted normal-case">
          on this page
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canAllocate && (
          <Button
            size="xs"
            className="bg-[#0f766e] hover:bg-[#0d645e] text-white border-none shadow-sm font-bold px-4"
            onClick={onAllocate}
          >
            Allocate {count} Lead{count === 1 ? '' : 's'}
          </Button>
        )}
        {canEscalate && (
          <Button
            size="xs"
            variant="outline"
            className="bg-white border-amber/20 text-amber shadow-sm font-bold px-4"
            onClick={onEscalate}
          >
            Escalate {count} Lead{count === 1 ? '' : 's'}
          </Button>
        )}
        <Button
          size="xs"
          variant="outline"
          className="bg-white border-border font-bold px-4"
          onClick={onClear}
        >
          Clear
        </Button>
      </div>
    </div>
  );
};

/**
 * The tick box itself. `indeterminate` is a DOM property with no JSX attribute,
 * so it has to be set through a ref -- without it the header box reads "all
 * selected" while only some rows on the page are.
 */
export const LeadCheckbox = ({ checked, indeterminate = false, onChange, label }) => (
  <input
    type="checkbox"
    aria-label={label}
    checked={checked}
    ref={el => { if (el) el.indeterminate = indeterminate; }}
    onChange={onChange}
    onClick={e => e.stopPropagation()}
    className="w-4 h-4 accent-[#0f766e] cursor-pointer align-middle"
  />
);

export default LeadSelectionBar;
