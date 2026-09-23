/**
 * How a role is written for people to read.
 *
 * The stored role is still 'executive' — renaming it would mean migrating every
 * user, lead and target — but nothing on screen should say so: the client calls
 * them District Managers. Anywhere a role is shown, run it through here rather
 * than through role.replace('_', ' '), which prints the stored word.
 */
const ROLE_LABELS = {
  founder: 'Founder',
  state_manager: 'State Manager',
  industry_manager: 'Industry Manager',
  executive: 'District Manager',
};

/** 'executive' -> 'District Manager'. Unknown roles fall back to title case. */
export const roleLabel = (role) => ROLE_LABELS[role]
  || String(role || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

/** The compact form for table cells: 'State Mgr', 'Ind. Mgr', 'District Manager'. */
export const shortRoleLabel = (role) => {
  if (role === 'state_manager') return 'State Mgr';
  if (role === 'industry_manager') return 'Ind. Mgr';
  return roleLabel(role);
};

export default roleLabel;
