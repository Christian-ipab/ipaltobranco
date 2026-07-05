import { createSign } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const PDF_MIME = 'application/pdf';
const OUTPUT_DIR = path.resolve('assets/boletins');
const CATALOG_FILE = path.join(OUTPUT_DIR, 'boletins-auto.js');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function readCredentials() {
  const raw = required('GOOGLE_SERVICE_ACCOUNT_JSON');
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  }
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

async function createAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsignedToken = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256')
    .update(unsignedToken)
    .end()
    .sign(credentials.private_key)
    .toString('base64url');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedToken}.${signature}`
    })
  });
  if (!response.ok) throw new Error(`Falha na autenticação do Google: ${response.status} ${await response.text()}`);
  return (await response.json()).access_token;
}

async function listChildren(folderId, accessToken) {
  const files = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime)',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`Falha ao listar o Drive: ${response.status} ${await response.text()}`);
    const data = await response.json();
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return files;
}

async function findPdfsRecursively(rootFolderId, accessToken) {
  const folders = [rootFolderId];
  const visited = new Set();
  const pdfs = [];
  while (folders.length) {
    const folderId = folders.shift();
    if (visited.has(folderId)) continue;
    visited.add(folderId);
    const children = await listChildren(folderId, accessToken);
    for (const file of children) {
      if (file.mimeType === DRIVE_FOLDER_MIME) folders.push(file.id);
      if (file.mimeType === PDF_MIME || file.name.toLowerCase().endsWith('.pdf')) pdfs.push(file);
    }
  }
  return pdfs;
}

const MONTHS = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12
};

function bulletinDate(file) {
  const normalized = file.name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
  const iso = normalized.match(/\b(20\d{2})[-_. ](\d{1,2})[-_. ](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;

  const written = normalized.match(/\b(\d{1,2})\s+(?:DE\s+)?(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)(?:\s+(?:DE\s+)?(20\d{2}))?\b/);
  if (!written) return null;
  const year = written[3] || new Date(file.modifiedTime).getUTCFullYear();
  return `${year}-${String(MONTHS[written[2]]).padStart(2, '0')}-${String(written[1]).padStart(2, '0')}`;
}

async function downloadPdf(file, outputPath, accessToken) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Falha ao baixar "${file.name}": ${response.status} ${await response.text()}`);
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

async function main() {
  const credentials = readCredentials();
  const rootFolderId = required('GOOGLE_DRIVE_FOLDER_ID');
  const accessToken = await createAccessToken(credentials);
  const files = await findPdfsRecursively(rootFolderId, accessToken);
  const byDate = new Map();

  for (const file of files) {
    const date = bulletinDate(file);
    if (!date) {
      console.warn(`Ignorado por não conter uma data reconhecível: ${file.name}`);
      continue;
    }
    const previous = byDate.get(date);
    if (!previous || new Date(file.modifiedTime) > new Date(previous.modifiedTime)) byDate.set(date, file);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  const catalog = [];
  for (const [date, file] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const filename = `boletim-${date}.pdf`;
    await downloadPdf(file, path.join(OUTPUT_DIR, filename), accessToken);
    catalog.push({ date, id: `boletim-${date}`, url: `assets/boletins/${filename}` });
    console.log(`Sincronizado: ${file.name} -> ${filename}`);
  }

  await writeFile(CATALOG_FILE, `window.IPAB_BOLETINS_AUTO = ${JSON.stringify(catalog, null, 2)};\n`, 'utf8');
  console.log(`${catalog.length} boletim(ns) publicado(s).`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
