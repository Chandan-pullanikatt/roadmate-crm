import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Row selection for a lead table. Every lead list in the app paginates and
 * filters server-side, so selection is kept as a flat list of ids and the
 * selected lead objects are resolved from whatever rows are currently loaded.
 *
 * `rows` is the page of leads on screen; `resetKey` is anything that changes what
 * is being listed (tab, filter, search, page). When it changes the selection is
 * dropped, because a bulk action on rows the manager can no longer see is a
 * mistake waiting to happen -- they would be allocating leads they never looked at.
 */
export const useLeadSelection = (rows = [], resetKey = '') => {
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    // Guarded so the first render and a key change with nothing ticked do not
    // queue a pointless re-render of the whole table.
    setSelectedIds(prev => (prev.length ? [] : prev));
  }, [resetKey]);

  // The bulk modals live in GlobalModals, outside this tree, so a finished
  // allocate or escalate says so with an event. Without it the bar went on
  // reading "5 leads selected" over rows that had just been handed to someone else.
  useEffect(() => {
    const onDone = () => setSelectedIds([]);
    window.addEventListener('leads-bulk-action-done', onDone);
    return () => window.removeEventListener('leads-bulk-action-done', onDone);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = useCallback((id) => {
    setSelectedIds(prev => (
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    ));
  }, []);

  const pageIds = useMemo(() => rows.map(r => r._id), [rows]);

  // The header checkbox covers the rows on screen only -- there is no
  // "select every lead matching this filter", because the client never has them.
  const allSelected = pageIds.length > 0 && pageIds.every(id => selectedSet.has(id));
  const someSelected = pageIds.some(id => selectedSet.has(id)) && !allSelected;

  const toggleAll = useCallback(() => {
    setSelectedIds(prev => {
      const onPage = new Set(pageIds);
      const everyOneOnPage = pageIds.length > 0 && pageIds.every(id => prev.includes(id));
      return everyOneOnPage
        ? prev.filter(id => !onPage.has(id))
        : [...prev.filter(id => !onPage.has(id)), ...pageIds];
    });
  }, [pageIds]);

  const clear = useCallback(() => setSelectedIds([]), []);

  // Only the rows still loaded can be described in a modal; ids selected on an
  // earlier page are dropped by the reset above, so this stays in step.
  const selectedLeads = useMemo(
    () => rows.filter(r => selectedSet.has(r._id)),
    [rows, selectedSet]
  );

  return {
    selectedIds,
    selectedLeads,
    isSelected: (id) => selectedSet.has(id),
    toggle,
    toggleAll,
    clear,
    allSelected,
    someSelected,
    count: selectedIds.length,
  };
};

export default useLeadSelection;
