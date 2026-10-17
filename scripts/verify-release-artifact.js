'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const target = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!target || !fs.existsSync(target)) {
  throw new Error('Usage: node scripts/verify-release-artifact.js <portable-directory>');
}

const allowedFiles = new Set([
  'Igroteka.exe',
  'data/igroteka.sqlite3',
  'seed-data/igroteka.sqlite3'
]);
const allowedDirs = new Set(['data', 'seed-data']);
const seenFiles = new Set();

function slash(rel) { return rel.split(path.sep).join('/'); }
function walk(dir, relBase = '') {
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    const abs = path.join(dir, ent.name);
    const rel = slash(path.join(relBase, ent.name));
    if (ent.isSymbolicLink()) throw new Error(`Symlink is not allowed in portable release: ${rel}`);
    if (ent.isDirectory()) {
      if (!allowedDirs.has(rel)) throw new Error(`Unexpected directory in portable release: ${rel}`);
      walk(abs, rel);
    } else if (ent.isFile()) {
      if (!allowedFiles.has(rel)) throw new Error(`Unexpected file in portable release: ${rel}`);
      seenFiles.add(rel);
    } else {
      throw new Error(`Unexpected filesystem entry in portable release: ${rel}`);
    }
  }
}
walk(target);
for (const rel of allowedFiles) {
  if (!seenFiles.has(rel)) throw new Error(`Release artifact is missing: ${rel}`);
}

function verifyDb(rel) {
  const file = path.join(target, rel);
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get();
    if (!integrity || Object.values(integrity)[0] !== 'ok') throw new Error(`SQLite integrity failed: ${rel}`);
    const journal = db.prepare('PRAGMA journal_mode').get();
    if (!journal || String(Object.values(journal)[0]).toLowerCase() !== 'delete') throw new Error(`SQLite journal_mode must be delete: ${rel}`);
    for (const table of ['games','trash','settings','metadata']) {
      if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)) {
        throw new Error(`Missing SQLite table ${table} in ${rel}`);
      }
    }
    const metadata = new Map(db.prepare('SELECT key,value FROM metadata').all().map(row => [row.key, row.value]));
    for (const [key, expected] of [['app','Игротека'],['storage_mode','sqlite'],['format_version','6']]) {
      if (metadata.get(key) !== expected) throw new Error(`Unexpected metadata ${key} in ${rel}`);
    }
    const uiRow = db.prepare("SELECT value FROM settings WHERE key='uiState'").get();
    if (!uiRow || typeof uiRow.value !== 'string') throw new Error(`Canonical uiState is missing: ${rel}`);
    const ui = JSON.parse(uiRow.value);
    for (const key of ['search','sort','quickFilter']) {
      if (!Object.prototype.hasOwnProperty.call(ui,key)) throw new Error(`Canonical uiState key missing (${key}): ${rel}`);
    }
    if (Object.prototype.hasOwnProperty.call(ui,'duplicateOnly')) throw new Error(`Retired duplicateOnly remains in ${rel}`);
  } finally {
    db.close();
  }
}

verifyDb('data/igroteka.sqlite3');
verifyDb('seed-data/igroteka.sqlite3');

const live = fs.readFileSync(path.join(target,'data','igroteka.sqlite3'));
const seed = fs.readFileSync(path.join(target,'seed-data','igroteka.sqlite3'));
if (!live.equals(seed)) throw new Error('Release live and seed SQLite must be byte-identical canonical copies.');

const exeSize = fs.statSync(path.join(target,'Igroteka.exe')).size;
if (exeSize < 1024 * 1024) throw new Error('Igroteka.exe is unexpectedly small.');
const dbSha = crypto.createHash('sha256').update(live).digest('hex');

console.log('Igroteka v1.1 Stable release artifact verification OK');
console.log(`- EXE: ${(exeSize / 1024 / 1024).toFixed(2)} MB`);
console.log('- Exact portable allowlist OK (3 runtime files)');
console.log('- SQLite integrity/schema/metadata/journal_mode OK');
console.log(`- Canonical live/seed SQLite byte identity OK (${dbSha.slice(0,12)}...)`);
