/**
 * Industries a District / Industry Manager can be assigned to.
 *
 * The list the client shows is stored in Config under the `industries` key so the
 * founder can extend it from the UI. These are the values used until the founder
 * saves their own list.
 */
const DEFAULT_INDUSTRIES = [
  'Grocery',
  'Restaurant',
  'Automobile',
  'Sports',
  'Textiles',
  'Others'
];

/**
 * Cleans a founder-submitted list: trims, drops blanks, removes case-insensitive
 * duplicates and keeps "Others" last so it always reads as the catch-all.
 */
const normalizeIndustries = (value) => {
  if (!Array.isArray(value)) return null;

  const seen = new Set();
  const cleaned = [];

  value.forEach((entry) => {
    const name = String(entry ?? '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cleaned.push(name);
  });

  if (!cleaned.length) return null;

  const others = cleaned.filter(n => n.toLowerCase() === 'others' || n.toLowerCase() === 'other');
  const rest = cleaned.filter(n => !others.includes(n));
  return [...rest, ...(others.length ? [others[0]] : [])];
};

module.exports = { DEFAULT_INDUSTRIES, normalizeIndustries };
