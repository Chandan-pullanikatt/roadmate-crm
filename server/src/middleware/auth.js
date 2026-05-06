const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded._id) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
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
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

module.exports = { verifyToken };
