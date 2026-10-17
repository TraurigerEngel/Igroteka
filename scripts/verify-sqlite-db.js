'use strict';
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('SQLite file not found.');
  process.exit(2);
}

let db;
try {
  db = new DatabaseSync(file, { readOnly: true });
  const integrity = db.prepare('PRAGMA integrity_check').get();
  if (!integrity || Object.values(integrity)[0] !== 'ok') {
    throw new Error('PRAGMA integrity_check failed.');
  }
  for (const table of ['games', 'trash', 'settings']) {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!row) throw new Error(`Missing required table: ${table}`);
  }
  console.log('SQLite verification OK');
} catch (error) {
  console.error(String(error && error.message ? error.message : error));
  process.exitCode = 1;
} finally {
  try { db?.close(); } catch {}
}
