const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { readContent, writeContent, recentHistory } = require('./db');
const { verifyCredentials, isLegacyMode } = require('./auth');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const SESSION_SECRET = process.env.SESSION_SECRET || (IS_PRODUCTION ? null : 'ipab-dev-session-secret');
if (!SESSION_SECRET) {
  console.error('[fatal] SESSION_SECRET must be set in production.');
  process.exit(1);
}

if (IS_PRODUCTION) {
  app.set('trust proxy', 1);
}

app.use(express.json({ limit: '25mb' }));
app.use(cookieSession({
  name: 'ipab.sid',
  keys: [SESSION_SECRET],
  maxAge: 1000 * 60 * 60 * 8,
  httpOnly: true,
  sameSite: 'lax',
  secure: IS_PRODUCTION
}));

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin === true) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' }
});

app.post('/api/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await verifyCredentials(username, password);
    if (!result.ok) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    req.session = { admin: true, username: result.username, issuedAt: Date.now() };
    return res.json({ ok: true, username: result.username });
  } catch (error) {
    next(error);
  }
});

app.post('/api/logout', requireAdmin, (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const authenticated = !!(req.session && req.session.admin === true);
  res.set('Cache-Control', 'no-store');
  res.json({
    authenticated,
    username: authenticated ? req.session.username || null : null,
    legacyMode: isLegacyMode()
  });
});

app.get('/api/content', requireAdmin, (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ content: readContent() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/public-content', (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ content: readContent() });
  } catch (error) {
    next(error);
  }
});

app.put('/api/content', requireAdmin, (req, res, next) => {
  try {
    if (!req.body || typeof req.body.content !== 'object' || req.body.content === null) {
      return res.status(400).json({ error: 'invalid_content' });
    }

    writeContent(req.body.content, req.session.username || 'unknown');
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, content: req.body.content });
  } catch (error) {
    next(error);
  }
});

app.get('/api/history', requireAdmin, (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ entries: recentHistory(20) });
  } catch (error) {
    next(error);
  }
});

function sendNoStoreFile(res, filePath) {
  res.set('Cache-Control', 'no-store');
  res.sendFile(filePath);
}

app.get('/', (req, res) => sendNoStoreFile(res, path.join(ROOT_DIR, 'index.html')));
app.get('/admin-login', (req, res) => res.redirect(302, '/admin-login.html'));
app.get('/admin-logi', (req, res) => res.redirect(302, '/admin-login.html'));
app.get('/admin', (req, res) => res.redirect(302, '/admin.html'));
app.get('/admin-login.html', (req, res) => sendNoStoreFile(res, path.join(ROOT_DIR, 'admin-login.html')));
app.get('/admin.html', (req, res) => sendNoStoreFile(res, path.join(ROOT_DIR, 'admin.html')));
app.use(express.static(ROOT_DIR));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, () => {
  console.log(`IPAB backend running on port ${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`);
  if (isLegacyMode()) {
    console.warn('[auth] Running in legacy single-password mode (ADMIN_PASSWORD). Migrate to ADMIN_USERS for multi-user support.');
  }
});
