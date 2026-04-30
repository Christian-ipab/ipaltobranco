const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || 'ipab2026').trim();

app.use(express.json({ limit: '25mb' }));
app.use(session({
  name: 'ipab.sid',
  secret: process.env.SESSION_SECRET || 'ipab-dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin === true) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

async function readContent() {
  try {
    const raw = await fs.readFile(CONTENT_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeContent(content) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONTENT_FILE, JSON.stringify(content, null, 2), 'utf8');
}

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (String(password || '').trim() !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  req.session.admin = true;
  return res.json({ ok: true });
});

app.post('/api/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('ipab.sid');
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  res.json({ authenticated: req.session && req.session.admin === true });
});

app.get('/api/content', requireAdmin, async (req, res, next) => {
  try {
    res.json({ content: await readContent() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/public-content', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ content: await readContent() });
  } catch (error) {
    next(error);
  }
});

app.put('/api/content', requireAdmin, async (req, res, next) => {
  try {
    if (!req.body || typeof req.body.content !== 'object' || req.body.content === null) {
      return res.status(400).json({ error: 'invalid_content' });
    }

    await writeContent(req.body.content);
    res.json({ ok: true, content: req.body.content });
  } catch (error) {
    next(error);
  }
});

app.get('/', (req, res) => res.sendFile(path.join(ROOT_DIR, 'index.html')));
app.get('/admin-login', (req, res) => res.redirect(302, '/admin-login.html'));
app.get('/admin-logi', (req, res) => res.redirect(302, '/admin-login.html'));
app.get('/admin', (req, res) => res.redirect(302, '/admin.html'));
app.get('/admin-login.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'admin-login.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(ROOT_DIR, 'admin.html')));
app.use(express.static(ROOT_DIR));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, () => {
  console.log(`IPAB backend running at http://localhost:${PORT}`);
});
