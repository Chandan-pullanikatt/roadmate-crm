const Counter = require('../models/Counter');
const Lead = require('../models/Lead');
const { prefixForSource, parseLeadId } = require('../constants/leadSources');

const counterKey = (prefix) => `leadId:${prefix}`;
const format = (prefix, seq) => `${prefix}${String(seq).padStart(2, '0')}`;

// Prefixes whose counter has been checked against existing leads in this process.
const seededPrefixes = new Set();

/**
 * The first time a prefix is used, start its counter after the highest ID that
 * already exists (e.g. RMFOL45 from an earlier sheet), so generated IDs never
 * repeat an uploaded one.
 */
const ensureSeeded = async (prefix) => {
  if (seededPrefixes.has(prefix)) return;
  const existing = await Lead.find({ leadId: { $regex: `^${prefix}\d+$` } }).select('leadId').lean();
  const max = existing.reduce((m, l) => Math.max(m, parseLeadId(l.leadId)?.seq || 0), 0);
  await Counter.updateOne({ _id: counterKey(prefix) }, { $max: { seq: max } }, { upsert: true });
  seededPrefixes.add(prefix);
};

/**
 * Next Lead ID for a source, e.g. "Direct" -> "RMDL07".
 * Returns undefined for a source with no ID pattern.
 */
const generateLeadId = async (source) => {
  const prefix = prefixForSource(source);
  if (!prefix) return undefined;
  await ensureSeeded(prefix);

  // The counter is atomic; the exists-check skips any number a sheet claimed since.
  for (;;) {
    const { seq } = await Counter.findOneAndUpdate(
      { _id: counterKey(prefix) },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    );
    const leadId = format(prefix, seq);
    if (!(await Lead.exists({ leadId }))) return leadId;
  }
};

/**
 * After a bulk upload, move each counter past the highest uploaded ID so the
 * next manually added lead continues from there.
 */
const syncCountersWithIds = async (leadIds) => {
  const maxByPrefix = new Map();
  for (const id of leadIds) {
    const parsed = parseLeadId(id);
    if (parsed) maxByPrefix.set(parsed.prefix, Math.max(maxByPrefix.get(parsed.prefix) || 0, parsed.seq));
  }
  await Promise.all([...maxByPrefix].map(([prefix, max]) =>
    Counter.updateOne({ _id: counterKey(prefix) }, { $max: { seq: max } }, { upsert: true })
  ));
};

module.exports = { generateLeadId, syncCountersWithIds };
