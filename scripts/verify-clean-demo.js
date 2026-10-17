'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const expected = '64699fdff58356482ab93effe6f3601d267b442306a0e10d8a0c29a5091d78c4';
const bytes = (rel) => fs.readFileSync(path.join(root, rel));
for (const rel of ['data/igroteka.sqlite3', 'seed-data/igroteka.sqlite3']) {
  const buf = bytes(rel);
  if (crypto.createHash('sha256').update(buf).digest('hex') !== expected) throw new Error('Demo DB hash mismatch: ' + rel);
  const db = new DatabaseSync(path.join(root, rel), {readOnly:true});
  try {
    for (const table of ['games','trash']) {
      const n = db.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n;
      if (n !== 0) throw new Error('Private library rows detected in ' + rel + ': ' + table);
    }
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('SQLite corruption');
  } finally { db.close(); }
}
const prohibited = ['app/shared/fonts/Inter-Regular.woff2','app/shared/fonts/Inter-Medium.woff2','app/shared/fonts/Inter-SemiBold.woff2','app/shared/fonts/Inter-Bold.woff2'];
for (const p of prohibited) if (fs.existsSync(path.join(root,p))) throw new Error('Unexpected bundled font: ' + p);
console.log('Igroteka privacy check OK: no personal games/trash, clean metadata, bundled font files excluded.');
