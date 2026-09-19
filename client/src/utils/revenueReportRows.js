// Flattens /dashboard/reports/revenue rows (one per payment) for the report
// tables and CSV exports, so every dashboard shows the same columns.

const PAYMENT_TYPES = {
  blocking_amount_received: 'Blocking Amount',
  full_amount_received: 'Full Amount',
  converted: 'Converted (deal value)',
};

const ROLE_LABELS = {
  founder: 'Founder',
  state_manager: 'State Manager',
  industry_manager: 'Industry Manager',
  executive: 'District Manager',
};

const withRole = (user) => (user?.name ? `${user.name}${user.role ? ` (${ROLE_LABELS[user.role] || user.role})` : ''}` : '—');

export const revenueReportRows = (data = []) =>
  data.map(r => ({
    Date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '',
    'Lead ID': r.lead?.leadId || '',
    Lead: r.lead?.company || r.lead?.name || '',
    'Payment Type': PAYMENT_TYPES[r.action] || r.action,
    Amount: r.amount || 0,
    'Collected By': r.collectedBy?.name || '—',
    'Lead Owner': withRole(r.owner),
    'Owner\'s Manager': withRole(r.ownerManager),
    Industry: r.lead?.industry || '',
    State: r.lead?.state || '',
    District: r.lead?.district || '',
  }));
