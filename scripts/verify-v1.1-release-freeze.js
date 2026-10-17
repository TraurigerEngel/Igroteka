'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert').strict;
const root = path.resolve(__dirname, '..');
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
const expected = {
  "app/core.js": "36493e6d92f9e577b8da86f8861daf17f9196adf66716ddcaccb0ba624f2a36d",
  "app/favicon.ico": "5ebb4ded9afce831918599f03bb6a4e59a5bb221d0974aa60122a748757dfd1f",
  "app/games.js": "cd8e08cc27956799408619d13af8354add6619a73edb622fdb073446f5cfb8f8",
  "app/index.html": "0f52e5e2f0ab7ff9b8253cfa27a60492c80ebbd52f97866a0095300aa373cb59",
  "app/runtime.js": "d482c8c0b0e9033bb43b8624adbf31e413f2201cce5cc0a4615443493abdfb73",
  "app/shared/browser-guard.js": "29af1be55af2623f956e7fbf65bcb3d20e541f4cc1749564a5a2c87310dc157f",
  "app/shared/fonts.css": "d4aa16c655671cef39b0c51c7f66e52b85911bcc4e58f161f8ffaaf2f206d1b1",
  "app/shared/igroteka-bridge.js": "2ddf0cc439c72226ea52accc49933cf7484d6964c140896ecdde84e6c9f8212d",
  "app/shared/lucide-icons.js": "37cafb460b5111689ffd6f612c83d4bfc7bdd9a32f2dc871ac70c272ea97bbf0",
  "app/shared/modal-system.css": "5a2f675c5e72d2f1d911a4a69edf107f6a852bceca8d529744eea9863464ee23",
  "app/shared/modal-system.js": "b55d38c6166ad99612234ec8e6a056007c74dc15662918be67e4d3fbb4e1c737",
  "app/shared/route-transition.css": "9f7373bbfa890b73507892e2274bf405940e39efa397858431e5ade21def23dd",
  "app/shared/route-transition.js": "2ebebf9d96f210a728ebbd1eaa9ac9e1ef51d4cc387fb15d7116e945c3867e30",
  "app/shared/startup-preview.css": "106aecca522ee812f5869d55c186146c04ad45713d57281a07b9f689aa1c18d6",
  "app/shared/tauri-titlebar.css": "54b422ed569f0e840654bdb95b05e94fac3e7e595e2cb2c066fe5f2c80133f5a",
  "app/shared/themed-select.css": "a3968641ad0c7c61c1950bd6662ac262063caa924669a6220792756804bb1253",
  "app/shared/themed-select.js": "5a2698671b7f3069f5f0690a2ec5a1bffb738a6670e6c5428f8b8954edb0ec52",
  "app/styles.css": "286520d31c7d5582ab9fc93c029da0f7eefe45132fad6d22475ac98566fd6d60",
  "app/trash.js": "06ce1912f2a10f12d8109bee0c468cc98e71303a27370f9114d93bf6a18afa9c",
  "data/igroteka.sqlite3": "64699fdff58356482ab93effe6f3601d267b442306a0e10d8a0c29a5091d78c4",
  "seed-data/igroteka.sqlite3": "64699fdff58356482ab93effe6f3601d267b442306a0e10d8a0c29a5091d78c4",
  "src-tauri/src/lib.rs": "c6da10327f9c7f9e885436152aa7dd376d06af31be5cdf6f0fe50f3667ce9c62",
  "src-tauri/src/main.rs": "70ba3d16c29c73267bcb728274ee2d84dc9e2633694dae2c4c5f5e313878743a",
  "src-tauri/src/storage.rs": "3f62ef52d3108158f0d7063f3fa12d9728325fb4b752917cccdba9aa3777c089"
};
for (const [rel, hash] of Object.entries(expected)) {
  assert.equal(sha(rel),hash,`v1.1 freeze violation: ${rel}`);
}
const configs = {
  "src-tauri/tauri.conf.json": {
    "$schema": "https://schema.tauri.app/config/2",
    "app": {
      "security": {
        "csp": null
      },
      "windows": [
        {
          "backgroundColor": "#020203",
          "decorations": false,
          "devtools": true,
          "height": 820,
          "label": "main",
          "limitNavigationsToAppBoundDomains": true,
          "maximized": true,
          "minHeight": 620,
          "minWidth": 780,
          "shadow": true,
          "title": "Игротека",
          "url": "index.html",
          "visible": false,
          "width": 1040,
          "zoomHotkeysEnabled": false
        }
      ],
      "withGlobalTauri": true
    },
    "build": {
      "frontendDist": "../app"
    },
    "bundle": {
      "active": false,
      "icon": [
        "icons/icon.ico"
      ]
    },
    "identifier": "com.lostheaven.igroteka",
    "productName": "Игротека",
    "version": "1.0.0"
  },
  "src-tauri/tauri.release.conf.json": {
    "$schema": "https://schema.tauri.app/config/2",
    "app": {
      "security": {
        "csp": {
          "base-uri": "'self'",
          "connect-src": "ipc: http://ipc.localhost",
          "default-src": "'self' customprotocol: asset:",
          "font-src": "'self' data:",
          "form-action": "'self'",
          "frame-src": "'none'",
          "img-src": "'self' asset: http://asset.localhost data: blob:",
          "object-src": "'none'",
          "style-src": "'self' 'unsafe-inline'"
        },
        "freezePrototype": true,
        "headers": {
          "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
          "X-Content-Type-Options": "nosniff"
        }
      },
      "windows": [
        {
          "backgroundColor": "#020203",
          "decorations": false,
          "devtools": false,
          "height": 820,
          "label": "main",
          "limitNavigationsToAppBoundDomains": true,
          "maximized": true,
          "minHeight": 620,
          "minWidth": 780,
          "shadow": true,
          "title": "Игротека",
          "url": "index.html",
          "visible": false,
          "width": 1040,
          "zoomHotkeysEnabled": false
        }
      ]
    },
    "version": "1.0.0"
  }
};
for (const [rel, baseline] of Object.entries(configs)) {
  const conf = JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
  assert.equal(conf.version,'1.1.0',`v1.1 Tauri version mismatch: ${rel}`);
  const withoutVersion = {...conf,version:baseline.version};
  assert.deepEqual(withoutVersion,baseline,`v1.1 rejected native config/geometry change: ${rel}`);
}
assert.ok(!fs.existsSync(path.join(root,'PREVIEW-ONLY.txt')),'Preview marker must not exist in Stable release source');
assert.ok(!fs.existsSync(path.join(root,'BUILD-PREVIEW.ps1')),'Preview build script must not exist in Stable release source');
assert.ok(!fs.existsSync(path.join(root,'README-PREVIEW.md')),'Preview docs must not exist in Stable release source');
assert.ok(!fs.existsSync(path.join(root,'scripts/verify-startup-titlebar-preview.js')),'Obsolete preview verifier must not exist');
const make = fs.readFileSync(path.join(root,'MAKE-FINAL-RELEASE.ps1'),'ascii');
const build = fs.readFileSync(path.join(root,'BUILD-RELEASE.ps1'),'ascii');
for (const code of [make,build]) {
  assert.ok(code.includes('Refusing to overwrite'),'Release scripts must refuse overwrite');
}
const db = fs.readFileSync(path.join(root,'data/igroteka.sqlite3'));
const seed = fs.readFileSync(path.join(root,'seed-data/igroteka.sqlite3'));
assert.ok(db.equals(seed),'canonical live/seed byte identity');
console.log('IGROTEKA v1.1 Accepted Preview Freeze + Edge Wrap RC: PASS');
console.log(`- Hotfix 4 app contract sealed: ${Object.keys(expected).filter(x=>x.startsWith('app/')).length} files (particle edge fix only in app/index.html)`);
console.log('- Rust runtime and native geometry unchanged; Clean demo SQLite live/seed sealed by SHA-256');
console.log('- Stable source marker and overwrite safety guards OK');
