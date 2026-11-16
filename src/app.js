const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');

const authRoutes = require('./routes/auth');
const dedicationRoutes = require('./routes/dedications');
const adminRoutes = require('./routes/admin');

const app = express();

// Behind a host's proxy (Render, Railway, nginx...) set TRUST_PROXY=1 so rate limiting sees each
// visitor's real IP instead of treating the whole school as one person.
if (config.trustProxy) app.set('trust proxy', config.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Helmet's default would force https and break http://localhost during development.
        upgradeInsecureRequests: null,
      },
    },
  })
);

const corsMiddleware = cors({
  origin(origin, cb) {
    // Allow tools without an Origin (curl, tests) and the configured frontend origins.
    if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed by CORS'));
  },
});
app.use((req, res, next) => {
  // Browsers send an Origin header even on same-site POST/PATCH/DELETE. When the site is served by
  // this app, those requests come from our own address and need no CORS handling at all.
  const origin = req.headers.origin;
  if (origin) {
    try {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      if (new URL(origin).host === host) return next();
    } catch {
      /* malformed Origin: fall through to the CORS check, which rejects it */
    }
  }
  return corsMiddleware(req, res, next);
});
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/dedications', dedicationRoutes);
app.use('/api/admin', adminRoutes);
// Unknown /api paths get JSON, never the website.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// The website itself (HTML, CSS, JS) lives in ./public and is served from the same address as the API.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((_req, res) => res.status(404).type('text/plain').send('Page not found.'));

// Central error handler: never leak stack traces to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }
  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

module.exports = app;
