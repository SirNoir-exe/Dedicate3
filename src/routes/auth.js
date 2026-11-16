const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const isTest = process.env.NODE_ENV === 'test';
const limiterBase = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
};

// Students at school share one public IP, so these limits must never be a single small bucket for
// the whole school. Login only counts FAILED attempts, and counts them per email, so one person
// mistyping a password never locks out anyone else.
const loginLimiter = rateLimit({
  ...limiterBase,
  limit: isTest ? 1000 : 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}|${String((req.body && req.body.schoolEmail) || '').trim().toLowerCase()}`,
});

// Sign-up is only a spam guard: generous enough for a whole computer lab signing up together.
const signupLimiter = rateLimit({
  ...limiterBase,
  limit: isTest ? 1000 : 200,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function publicUser(u) {
  return {
    id: u.id,
    fullName: u.full_name,
    schoolEmail: u.school_email,
    className: u.class_name,
    role: u.role,
  };
}

// POST /api/auth/signup
router.post('/signup', signupLimiter, (req, res) => {
  const { fullName, schoolEmail, className, password } = req.body || {};

  const name = String(fullName || '').trim();
  const email = String(schoolEmail || '').trim().toLowerCase();
  const cls = String(className || '').trim();
  const pass = String(password || '');

  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'Please enter your full name.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid school email.' });
  }
  if (config.allowedEmailDomain && !email.endsWith('@' + config.allowedEmailDomain)) {
    return res
      .status(400)
      .json({ error: `Please use your school email (@${config.allowedEmailDomain}).` });
  }
  if (cls.length > 30) {
    return res.status(400).json({ error: 'Class name is too long.' });
  }
  if (pass.length < 8 || pass.length > 128) {
    return res.status(400).json({ error: 'Password must be 8 to 128 characters.' });
  }

  const exists = db.prepare('SELECT 1 FROM users WHERE school_email = ?').get(email);
  if (exists) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const hash = bcrypt.hashSync(pass, 12);
  // Public sign-up can only ever create students. Staff accounts are made via the CLI script.
  const info = db
    .prepare(
      `INSERT INTO users (full_name, school_email, class_name, password_hash, role)
       VALUES (?, ?, ?, ?, 'student')`
    )
    .run(name, email, cls || null, hash);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const email = String((req.body || {}).schoolEmail || '').trim().toLowerCase();
  const pass = String((req.body || {}).password || '');

  const user = db.prepare('SELECT * FROM users WHERE school_email = ?').get(email);
  // Same message for "no such user" and "wrong password" so emails can't be probed.
  if (!user || !bcrypt.compareSync(pass, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser({ ...req.user }) });
});

module.exports = router;
