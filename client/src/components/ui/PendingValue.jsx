import React from 'react';

/**
 * Renders a number that may not have arrived yet. Until the query answers, a
 * figure of 0 is a lie a manager will act on ("my leads are gone"), so a
 * pulsing bar stands in for it; if the request failed, a dash says "unknown"
 * rather than "none".
 */
const PendingValue = ({ value, loading, error = false, className = 'h-6 w-10' }) => {
  if (error) return <span title="Could not load">—</span>;
  if (loading) {
    return <span className={`inline-block align-middle rounded-md animate-pulse bg-border/50 ${className}`} />;
  }
  return <>{value}</>;
};

export default PendingValue;
