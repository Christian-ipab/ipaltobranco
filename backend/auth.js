const bcrypt = require('bcryptjs');

const LEGACY_USERNAME = 'admin';

function parseAdminUsers(raw) {
  if (!raw) return new Map();
  const map = new Map();
  for (const entry of String(raw).split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const sep = trimmed.indexOf(':');
    if (sep <= 0) continue;
    const username = trimmed.slice(0, sep).trim().toLowerCase();
    const hash = trimmed.slice(sep + 1).trim();
    if (!username || !hash) continue;
    map.set(username, hash);
  }
  return map;
}

const adminUsers = parseAdminUsers(process.env.ADMIN_USERS);
const legacyPassword = String(process.env.ADMIN_PASSWORD || '').trim();

if (adminUsers.size === 0 && !legacyPassword) {
  console.warn('[auth] No ADMIN_USERS or ADMIN_PASSWORD set. Login disabled.');
}

function isLegacyMode() {
  return adminUsers.size === 0 && legacyPassword.length > 0;
}

async function verifyCredentials(username, password) {
  const cleanPassword = String(password || '');
  const cleanUsername = String(username || '').trim().toLowerCase();

  if (isLegacyMode()) {
    const expected = cleanUsername === '' || cleanUsername === LEGACY_USERNAME;
    if (expected && cleanPassword.trim() === legacyPassword) {
      return { ok: true, username: LEGACY_USERNAME };
    }
    return { ok: false };
  }

  if (!cleanUsername) return { ok: false };
  const hash = adminUsers.get(cleanUsername);
  if (!hash) {
    await bcrypt.compare(cleanPassword, '$2a$10$invalidinvalidinvalidinvaliduOOOOOOOOOOOOOOOOOOOOOOOOOOOOO');
    return { ok: false };
  }
  const ok = await bcrypt.compare(cleanPassword, hash);
  return ok ? { ok: true, username: cleanUsername } : { ok: false };
}

module.exports = { verifyCredentials, isLegacyMode };
