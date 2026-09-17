/**
 * Lead sources and the Lead ID prefix each one generates.
 *
 * A lead added through the form gets `<prefix><count>` (RMFOL01, RMFOL02, ...).
 * Bulk-uploaded leads keep the Lead ID from the sheet instead.
 *
 * Mirrored on the client in client/src/constants/leadSources.js.
 * Change both together.
 */

const LEAD_SOURCES = [
  { label: 'Old Franchise Leads',    prefix: 'RMFOL' },
  { label: 'Online Campaign - Meta', prefix: 'RMFLM' },
  { label: 'Sports Leads',           prefix: 'RMSL' },
  { label: 'Franchise Reference',    prefix: 'RMFR' },
  { label: 'Team Reference',         prefix: 'RMTR' },
  { label: 'Cold Call',              prefix: 'RMCL' },
  { label: 'Website',                prefix: 'RMWL' },
  { label: 'Direct',                 prefix: 'RMDL' },
  { label: 'Physical Campaign',      prefix: 'RMPC' },
];

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Returns the ID prefix for a source label (case-insensitive), or null if unknown. */
const prefixForSource = (source) =>
  LEAD_SOURCES.find((s) => normalize(s.label) === normalize(source))?.prefix || null;

/**
 * Splits an ID like "RMFOL12" into its known prefix and number,
 * or returns null when it doesn't follow one of the patterns above.
 */
const parseLeadId = (leadId) => {
  const match = /^([A-Z]+)(\d+)$/.exec(String(leadId || '').trim().toUpperCase());
  if (!match || !LEAD_SOURCES.some((s) => s.prefix === match[1])) return null;
  return { prefix: match[1], seq: Number(match[2]) };
};

module.exports = { LEAD_SOURCES, prefixForSource, parseLeadId };
