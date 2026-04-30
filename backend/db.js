const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const HISTORY_FILE = path.join(DATA_DIR, 'content-history.jsonl');
const TMP_FILE = path.join(DATA_DIR, 'content.json.tmp');

fs.mkdirSync(DATA_DIR, { recursive: true });

function readContent() {
  try {
    const raw = fs.readFileSync(CONTENT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed.data ?? null : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function writeContent(content, updatedBy) {
  const record = {
    data: content,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy || 'unknown'
  };
  const json = JSON.stringify(record, null, 2);
  fs.writeFileSync(TMP_FILE, json, 'utf8');
  fs.renameSync(TMP_FILE, CONTENT_FILE);
  fs.appendFileSync(
    HISTORY_FILE,
    JSON.stringify({ updated_at: record.updated_at, updated_by: record.updated_by }) + '\n',
    'utf8'
  );
}

function recentHistory(limit = 20) {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const tail = lines.slice(-limit).reverse();
    return tail.map((line, i) => {
      const parsed = JSON.parse(line);
      return { id: lines.length - i, ...parsed };
    });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

module.exports = {
  DATA_DIR,
  CONTENT_FILE,
  readContent,
  writeContent,
  recentHistory
};
