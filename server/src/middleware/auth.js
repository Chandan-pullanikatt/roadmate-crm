const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Tokens live for 7 days, so a deactivated account has to be caught per request,
// not just at login. The lookup is cached briefly to avoid a DB hit on every call;
// setting a user's status clears their entry so the change applies immediately.
const ACTIVE_TTL_MS = 30 * 1000;
const activeCache = new Map();

const isUserActive = async (userId) => {
  const key = String(userId);
  const hit = activeCache.get(key);
  if (hit && Date.now() - hit.at < ACTIVE_TTL_MS) return hit.active;
  const user = await User.findById(userId).select('isActive').lean();
  const active = !!user && user.isActive !== false;
  activeCache.set(key, { active, at: Date.now() });
  return active;
};

const clearActiveCache = (userId) => activeCache.delete(String(userId));

const INACTIVE_RESPONSE = {
  message: 'Your account has been deactivated. Please contact the founder.',
  code: 'ACCOUNT_INACTIVE',
};

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
  if (!decoded._id) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }

  try {
    if (!(await isUserActive(decoded._id))) {
      return res.status(403).json(INACTIVE_RESPONSE);
    }
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }

  req.user = {
    _id:         decoded._id,
    role:        decoded.role,
    name:        decoded.name,
    state:       decoded.state       || null,
    industry:    decoded.industry    || null,
    district:    decoded.district    || null,
    reportingTo: decoded.reportingTo || null,
  };
  next();
};

module.exports = { verifyToken, isUserActive, clearActiveCache, INACTIVE_RESPONSE };
