const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

// Requires a valid "Authorization: Bearer <token>" header.
// Loads the user fresh from the DB so role changes / deletions take effect immediately.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db
      .prepare('SELECT id, full_name, school_email, class_name, role FROM users WHERE id = ?')
      .get(payload.sub);
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

// Only staff accounts (you and the social prefect) get through.
function requireStaff(req, res, next) {
  if (!req.user || req.user.role !== 'staff') {
    return res.status(403).json({ error: 'You do not have access to this panel.' });
  }
  next();
}

module.exports = { requireAuth, requireStaff };
