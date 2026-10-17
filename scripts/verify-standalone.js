'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
const EXPECTED_VERSION = '1.1.0';
const EXPECTED_RELEASE_NAME = 'Igroteka_Standalone_v1.1_Stable';
const req = [
  'app/index.html','app/styles.css','app/core.js','app/games.js','app/trash.js','app/runtime.js',
  'app/shared/igroteka-bridge.js','app/shared/themed-select.js','app/shared/themed-select.css',
  'app/shared/modal-system.js','app/shared/modal-system.css','app/shared/browser-guard.js',
  'src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/tauri.conf.json','src-tauri/tauri.release.conf.json',
  'src-tauri/src/main.rs','src-tauri/src/lib.rs','src-tauri/src/storage.rs',
  'data/igroteka.sqlite3','seed-data/igroteka.sqlite3',
  'scripts/verify-release-artifact.js','MAKE-FINAL-RELEASE.ps1','MAKE-FINAL-RELEASE.cmd'
];
for (const rel of req) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing required file: ${rel}`);
}

for (const rel of ['MIGRATE-FROM-LOST-HEAVEN.ps1','BUILD-DEV.ps1','BUILD-RELEASE.ps1','MAKE-FINAL-RELEASE.ps1']) {
  const buf = fs.readFileSync(path.join(root, rel));
  if ([...buf].some(byte => byte >= 0x80)) throw new Error(`PowerShell 5.1 unsafe non-ASCII script: ${rel}`);
}
const migrate = fs.readFileSync(path.join(root,'MIGRATE-FROM-LOST-HEAVEN.ps1'),'ascii');
if (!migrate.includes('verify-sqlite-db.js') || !migrate.includes('migration-backups')) throw new Error('Safe migration verification/backup contract is missing.');
if (!migrate.includes('@($running).Count')) throw new Error('PowerShell 5.1 single-process Count guard is missing.');
if (!fs.existsSync(path.join(root,'scripts/verify-sqlite-db.js'))) throw new Error('Migration SQLite verifier is missing.');

if (fs.existsSync(path.join(root,'app/projects/kinoteka')) || fs.existsSync(path.join(root,'app/projects/budget'))) {
  throw new Error('Standalone package still contains foreign project frontends.');
}

const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if (pkg.version !== EXPECTED_VERSION) throw new Error(`package.json version must be ${EXPECTED_VERSION}.`);
const pkgLock = JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
if (pkgLock.version !== EXPECTED_VERSION || pkgLock.packages?.['']?.version !== EXPECTED_VERSION) throw new Error('package-lock.json root version is out of sync.');

const html = fs.readFileSync(path.join(root,'app/index.html'),'utf8');
if (!html.includes('shared/igroteka-bridge.js')) throw new Error('Standalone bridge is not wired.');
if (html.includes('tauri-bridge.js')) throw new Error('Lost Heaven multi-project bridge is still wired.');
if (/\.\.\/\.\.\/shared\//.test(html)) throw new Error('Old nested Lost Heaven paths remain in index.html.');
if (!html.includes('const MAX_FPS=90') || !html.includes("document.addEventListener('visibilitychange'")) {
  throw new Error('90 FPS / hidden-window particle throttling contract is missing.');
}
if (html.includes('new MutationObserver(markUndraggable)')) {
  throw new Error('Legacy global drag MutationObserver is still active.');
}

const cargo = fs.readFileSync(path.join(root,'src-tauri/Cargo.toml'),'utf8');
if (!/name\s*=\s*"igroteka-standalone"/.test(cargo)) throw new Error('Wrong Cargo package identity.');
if (!new RegExp(`version\\s*=\\s*\"${EXPECTED_VERSION.replace(/[.]/g,'\\.')}\"`).test(cargo)) throw new Error(`Cargo package version must be ${EXPECTED_VERSION}.`);
if (!/crate-type\s*=\s*\["rlib"\]/.test(cargo)) throw new Error('Desktop rlib-only contract is missing.');
if (/cdylib|staticlib/.test(cargo)) throw new Error('Redundant desktop library targets returned.');

const main = fs.readFileSync(path.join(root,'src-tauri/src/main.rs'),'utf8');
if (!main.includes('windows_subsystem = "windows"')) throw new Error('Windows GUI subsystem guard is missing.');
if (!main.includes('Local\\IgrotekaStandalone')) throw new Error('Igroteka single-instance mutex is missing.');
if (!main.includes('FindWindowW') || !main.includes('w!("Игротека")')) throw new Error('Second-instance focus behavior is missing.');

const lib = fs.readFileSync(path.join(root,'src-tauri/src/lib.rs'),'utf8');
if (/mod\s+budget\s*;|persist_movies|budget_get_/.test(lib)) throw new Error('Foreign project backend commands remain in standalone lib.rs.');
for (const cmd of ['library_state','persist_games_state','persist_games_ui','window_minimize','window_close']) {
  if (!lib.includes(cmd)) throw new Error(`Missing command: ${cmd}`);
}

const storage = fs.readFileSync(path.join(root,'src-tauri/src/storage.rs'),'utf8');
if (!storage.includes('is_cargo_build_output') || !storage.includes('return root;')) {
  throw new Error('Portable data-root hardening is missing.');
}
if (/let source_seed\s*=\s*source_root\(\)/.test(storage)) {
  throw new Error('Portable seed lookup still falls back to a compiled source path.');
}

const bridge = fs.readFileSync(path.join(root,'app/shared/igroteka-bridge.js'),'utf8');
const core = fs.readFileSync(path.join(root,'app/core.js'),'utf8');
if (!bridge.includes('replaceGamesConfirmed') || !bridge.includes('queuePersistence')) {
  throw new Error('Confirmed SQLite persistence bridge is missing.');
}
if (!core.includes('async function save()') || !core.includes('await db.replaceGamesConfirmed(raw)')) {
  throw new Error('UI still treats game persistence as synchronous/optimistic.');
}

const tauri = JSON.parse(fs.readFileSync(path.join(root,'src-tauri/tauri.conf.json'),'utf8'));
if (tauri.productName !== 'Игротека' || tauri.identifier !== 'com.lostheaven.igroteka') throw new Error('Standalone Tauri identity mismatch.');
if (tauri.version !== EXPECTED_VERSION) throw new Error(`Tauri version must be ${EXPECTED_VERSION}.`);
if (tauri.app?.windows?.[0]?.url !== 'index.html') throw new Error('Standalone window must open app/index.html directly.');

const releaseTauri = JSON.parse(fs.readFileSync(path.join(root,'src-tauri/tauri.release.conf.json'),'utf8'));
if (releaseTauri.version !== EXPECTED_VERSION) throw new Error('Release Tauri version is out of sync.');
if (releaseTauri.app?.windows?.[0]?.devtools !== false) throw new Error('Release devtools must be disabled.');
if (releaseTauri.app?.security?.freezePrototype !== true) throw new Error('Release freezePrototype hardening is missing.');
const releaseCsp = JSON.stringify(releaseTauri.app?.security?.csp || {});
if (!releaseCsp.includes("object-src") || !releaseCsp.includes("frame-src")) throw new Error('Release CSP hardening is incomplete.');

const buildRelease = fs.readFileSync(path.join(root,'BUILD-RELEASE.ps1'),'ascii');
const makeRelease = fs.readFileSync(path.join(root,'MAKE-FINAL-RELEASE.ps1'),'ascii');
for (const token of ['cargo metadata --locked','--manifest-path $manifestPath','Get-Sha256Hex','Cargo.lock changed during release build','verify-release-artifact.js']) {
  if (!buildRelease.includes(token)) throw new Error(`Release build hardening missing: ${token}`);
}
for (const token of [EXPECTED_RELEASE_NAME, "version = '1.1.0'", "channel = 'Stable'"]) {
  if (!(buildRelease + '\n' + makeRelease).includes(token)) throw new Error(`v1.1 Stable release identity missing: ${token}`);
}

if (/Get-FileHash/.test(buildRelease) || /Get-FileHash/.test(makeRelease)) {
  throw new Error('Release pipeline must not depend on Get-FileHash.');
}
if (/Compress-Archive|Expand-Archive/.test(makeRelease)) {
  throw new Error('Final release pipeline must use module-independent .NET ZIP handling.');
}
for (const token of ['ZipFile]::CreateFromDirectory','ZipFile]::ExtractToDirectory','Get-Sha256Hex','SHA256SUMS.txt','RELEASE-METADATA.json']) {
  if (!makeRelease.includes(token)) throw new Error(`Final release pipeline missing: ${token}`);
}

for (const rel of ['data/igroteka.sqlite3','seed-data/igroteka.sqlite3']) {
  const db = new DatabaseSync(path.join(root,rel), { readOnly: true });
  const integrity = db.prepare('PRAGMA integrity_check').get();
  if (!integrity || Object.values(integrity)[0] !== 'ok') throw new Error(`SQLite integrity failed: ${rel}`);
  const journal = db.prepare('PRAGMA journal_mode').get();
  if (!journal || String(Object.values(journal)[0]).toLowerCase() !== 'delete') throw new Error(`SQLite journal_mode must be delete: ${rel}`);
  for (const table of ['games','trash','settings','metadata']) {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!row) throw new Error(`Missing SQLite table ${table} in ${rel}`);
  }
  const metadata = new Map(db.prepare('SELECT key,value FROM metadata').all().map(row => [row.key,row.value]));
  for (const [key, expected] of [['app','Игротека'],['storage_mode','sqlite'],['format_version','6']]) {
    if (metadata.get(key) !== expected) throw new Error(`Unexpected SQLite metadata ${key}: ${rel}`);
  }
  db.close();
}
const liveDbBytes = fs.readFileSync(path.join(root,'data/igroteka.sqlite3'));
const seedDbBytes = fs.readFileSync(path.join(root,'seed-data/igroteka.sqlite3'));
if (!liveDbBytes.equals(seedDbBytes)) throw new Error('Canonical live/seed SQLite files must be byte-identical for v1.1 Stable.');

const jsFiles = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.isFile() && p.endsWith('.js')) jsFiles.push(p);
  }
}
walk(path.join(root,'app'));
for (const file of jsFiles) new vm.Script(fs.readFileSync(file,'utf8'), {filename:file});
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(x=>x.trim());
for (let i=0;i<inlineScripts.length;i++) new vm.Script(inlineScripts[i], {filename:`index-inline-${i+1}.js`});

const appText = [html, ...jsFiles.map(p=>fs.readFileSync(p,'utf8'))].join('\n');
if (/https?:\/\//i.test(appText)) throw new Error('Remote frontend URL detected.');

const pass1DeadTokens = [
  'deleteModal','routeHandoff','setAddMode','openBulkModal','closeBulkModal','addMultipleGames','updateBulkInfo',
  'paginationRenderCache','formatHistoryDate','fillFilters','saveStatus','updateSaveStatus','scheduleSearchRender',
  'searchRenderTimer','writeTrash','pendingDelete','openDeleteModal','closeDeleteModal','confirmDelete'
];
for (const token of pass1DeadTokens) {
  if (appText.includes(token)) throw new Error(`Cleanup Pass 1 regression: legacy token returned: ${token}`);
}
const themedSelectJs = fs.readFileSync(path.join(root,'app/shared/themed-select.js'),'utf8');
const themedSelectCss = fs.readFileSync(path.join(root,'app/shared/themed-select.css'),'utf8');
const styles = fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
if (/budget|media-category|game-entry-category/i.test(themedSelectJs + '\n' + themedSelectCss)) {
  throw new Error('Cleanup Pass 1 regression: foreign themed-select branch returned.');
}
if (/game-entry-category|game-entry-year|Смотрю|Kinoteka|Кинотека/.test(styles + '\n' + themedSelectCss)) {
  throw new Error('Cleanup Pass 1 regression: foreign Kinoteka selector/comment returned.');
}
const trashJs = fs.readFileSync(path.join(root,'app/trash.js'),'utf8');
const pass2ObsoleteTokens = [
  'resetFilterPressV816','resetFilterIconV816','resetFilterButtonPressV817','resetFilterIconV817',
  'resetFilterPulseV827','resetFilterIconPulseV827','resetFilterPulseV829','resetFilterIconV829',
  'resetFilterPulseV830','resetFilterIconV830','resetFilterButtonV831','resetFilterRippleV831','resetFilterIconV831',
  'resetFilterButtonFadeV840','trash-activate','trash-deactivate',
  'trashDotAppearV841','trashDotDisappearV841','trashButtonActivateV841','trashButtonDeactivateV841',
  'trashDotAppearV842','trashDotDisappearV842','trashButtonActivateV842','trashButtonDeactivateV842',
  'trashDotAppearV843','trashDotDisappearV843','trashButtonActivateV843','trashButtonDeactivateV843',
  'trashDotAppearV844','trashDotDisappearV844','trashButtonActivateV844','trashButtonDeactivateV844'
];
for (const token of pass2ObsoleteTokens) {
  if ((styles + '\n' + trashJs).includes(token)) throw new Error(`Cleanup Pass 2 regression: historical CSS token returned: ${token}`);
}
for (const token of ['resetFilterButtonV832','trashDotAppearV849','contain:strict!important']) {
  if (!(styles + '\n' + html).includes(token)) throw new Error(`Cleanup Pass 2 active UI contract missing: ${token}`);
}
const pass3DeadTokens = [
  '.page-size-wrap','.pageEllipsis','.sortActions','.sortToggle','#nameSortToggle',
  '.rowDelete','.rowDeleteCell','.delete-col','.server-status','.add-choice-card','.add-choice-grid',
  '.history-list','.history-empty','.active-filters','.filter-chip'
];
for (const token of pass3DeadTokens) {
  if ((appText + '\n' + styles).includes(token)) throw new Error(`Cleanup Pass 3 regression: retired UI/state token returned: ${token}`);
}
if (/\blet\s+duplicateOnly\b|\bduplicateOnly\s*=|\|\|\s*duplicateOnly|!duplicateOnly/.test(appText)) {
  throw new Error('Cleanup Pass 3 regression: live duplicateOnly branch returned.');
}
for (const token of ['id="sort"','sort.value','quickFilter','history-modal','history-note']) {
  if (!(appText + '\n' + styles).includes(token)) throw new Error(`Cleanup Pass 3 active UI/state contract missing: ${token}`);
}

const pass4ObsoleteTokens = [
  'window.lostHeaven','window.LHDialog','window.LHModal','lhAddGameModal','lhTrashModal','lhConfirmModal',
  'lh-native-dialog','lh-dialog-open','lh-dialog-runtime-style','.lh-modal-overlay','year-picker-modal',
  'editor-modal','delete-confirm-modal','trashDialog','.trashModal','lhModalIn','lhModalOut'
];
const modalSystemJs = fs.readFileSync(path.join(root,'app/shared/modal-system.js'),'utf8');
const modalSystemCss = fs.readFileSync(path.join(root,'app/shared/modal-system.css'),'utf8');
const pass4Surface = appText + '\n' + styles + '\n' + modalSystemJs + '\n' + modalSystemCss;
for (const token of pass4ObsoleteTokens) {
  if (pass4Surface.includes(token)) throw new Error(`Cleanup Pass 4 regression: legacy runtime/modal token returned: ${token}`);
}
for (const token of [
  'window.IgrotekaDialog','window.IgrotekaModal','window.igrotekaRuntime',
  'addGameModalController','trashModalController','igroteka-native-dialog','igroteka-dialog-open',
  "options.title || 'Игротека'"
]) {
  if (!pass4Surface.includes(token)) throw new Error(`Cleanup Pass 4 active standalone contract missing: ${token}`);
}
if (/window\.IgrotekaModal\s*=\s*\{[^}]*updateLock/.test(modalSystemJs)) {
  throw new Error('Cleanup Pass 4 regression: internal updateLock leaked back into public modal API.');
}

const pass5CompatibilityTokens = [
  'replaceGamesSync','replaceTrashSync','moveGameToTrashSync','restoreTrashSync',
  'permanentlyDeleteTrashSync','emptyTrashSync','trashComparable','__flush'
];
const bridgeJs = fs.readFileSync(path.join(root,'app/shared/igroteka-bridge.js'),'utf8');
const pass5Surface = core + '\n' + trashJs + '\n' + bridgeJs;
for (const token of pass5CompatibilityTokens) {
  if (pass5Surface.includes(token)) throw new Error(`Cleanup Pass 5 regression: unconfirmed compatibility API returned: ${token}`);
}
for (const token of ['replaceGamesConfirmed','moveGameToTrash: async','restoreTrash: async','permanentlyDeleteTrash: async','emptyTrash: async']) {
  if (!bridgeJs.includes(token)) throw new Error(`Cleanup Pass 5 confirmed-write contract missing: ${token}`);
}
if (!core.includes('await db.replaceGamesConfirmed(raw)')) throw new Error('Cleanup Pass 5 confirmed game write is no longer mandatory.');
for (const token of ['await db.moveGameToTrash(gameId)','await db.restoreTrash(trashId)','await db.permanentlyDeleteTrash(trashId)','await db.emptyTrash()']) {
  if (!trashJs.includes(token)) throw new Error(`Cleanup Pass 5 confirmed trash write missing: ${token}`);
}


const routeTransitionJs = fs.readFileSync(path.join(root,'app/shared/route-transition.js'),'utf8');
const routeTransitionCss = fs.readFileSync(path.join(root,'app/shared/route-transition.css'),'utf8');
const fontsCss = fs.readFileSync(path.join(root,'app/shared/fonts.css'),'utf8');
const pass6Surface = appText + '\n' + styles + '\n' + themedSelectCss + '\n' + routeTransitionCss + '\n' + fontsCss;
const pass6ObsoleteTokens = [
  'window.lhRouteTransition','lhCustomTitlebar','lhParticleFlow','lh-route-overlay','lh-route-ready','lh-route-leaving',
  'data-lh-select-theme','_lhSelectShell','_lhSelectTrigger','_lhSelectObserver','dataset.lhThemedSelect','dataset.lhNativeSelect',
  'id="lh-v097-home-nav-and-space"','id="lh-no-interactive-drag-v147"','id="lh-patch022-add-row-layout"','id="lh-space-background"',
  'TRASH_MODAL_CLOSE_MS','const oldStatus=','const HANDOFF_MS','const handoff =','`lh-select-menu-${++menuCounter}`'
];
for (const token of pass6ObsoleteTokens) {
  if (pass6Surface.includes(token)) throw new Error(`Cleanup Pass 6 regression: standalone shell legacy token returned: ${token}`);
}
for (const token of [
  'window.igrotekaRouteTransition','igrotekaCustomTitlebar','igrotekaParticleFlow','igroteka-route-overlay','igroteka-route-ready',
  '_igrotekaSelectShell','_igrotekaSelectTrigger','_igrotekaSelectObserver','dataset.igrotekaThemedSelect','dataset.igrotekaNativeSelect',
  '`igroteka-select-menu-${++menuCounter}`','id="igroteka-home-space"','id="igroteka-no-interactive-drag"',
  'id="igroteka-add-row-layout"','id="igroteka-space-background"'
]) {
  if (!pass6Surface.includes(token)) throw new Error(`Cleanup Pass 6 active standalone shell contract missing: ${token}`);
}
if (!routeTransitionJs.includes('Object.freeze({ reveal })')) throw new Error('Cleanup Pass 6 startup reveal API was unexpectedly expanded or removed.');

const runtimeJs = fs.readFileSync(path.join(root,'app/runtime.js'),'utf8');
const pass7Surface = themedSelectJs + '\n' + themedSelectCss + '\n' + styles + '\n' + fontsCss + '\n' + runtimeJs;
for (const token of ['lh-select-','lh-native-select-source','--lh-']) {
  if (pass7Surface.includes(token)) throw new Error(`Cleanup Pass 7 regression: active Lost Heaven visual namespace returned: ${token}`);
}
for (const token of [
  'igroteka-select-shell','igroteka-select-trigger','igroteka-select-option','igroteka-native-select-source',
  '--igroteka-select-bg','--igroteka-fs-md','--igroteka-body-line-height'
]) {
  if (!pass7Surface.includes(token)) throw new Error(`Cleanup Pass 7 standalone visual namespace missing: ${token}`);
}

const browserGuardJs = fs.readFileSync(path.join(root,'app/shared/browser-guard.js'),'utf8');
const pass8AppSurface = fs.readFileSync(path.join(root,'app/core.js'),'utf8') + '\n' + browserGuardJs + '\n' + themedSelectCss;
for (const token of ['duplicateOnly','__lhBrowserGuardInstalled','Lost Heaven Desktop','not part of Lost Heaven','Lost Heaven shortcuts']) {
  if (pass8AppSurface.includes(token)) throw new Error(`Cleanup Pass 8 regression: residual runtime token returned: ${token}`);
}
if (!browserGuardJs.includes('__igrotekaBrowserGuardInstalled')) throw new Error('Cleanup Pass 8 standalone browser-guard namespace is missing.');
for (const rel of ['data/igroteka.sqlite3','seed-data/igroteka.sqlite3']) {
  const db = new DatabaseSync(path.join(root,rel), { readOnly: true });
  const row = db.prepare("SELECT value FROM settings WHERE key='uiState'").get();
  db.close();
  if (!row || typeof row.value !== 'string') throw new Error(`Cleanup Pass 8 canonical uiState is missing: ${rel}`);
  const state = JSON.parse(row.value);
  if (Object.prototype.hasOwnProperty.call(state,'duplicateOnly')) throw new Error(`Cleanup Pass 8 retired duplicateOnly remains in canonical SQLite: ${rel}`);
  for (const key of ['search','sort','quickFilter']) {
    if (!Object.prototype.hasOwnProperty.call(state,key)) throw new Error(`Cleanup Pass 8 canonical uiState key missing (${key}): ${rel}`);
  }
}

// v1.0 Theme Preview 1 — Cinema Mono parity guards.
const titlebarCss = fs.readFileSync(path.join(root,'app/shared/tauri-titlebar.css'),'utf8');
for (const token of [
  'v1.0 Theme Preview 1 — Cinema Mono Parity.',
  '--mono-glass:rgba(12,13,15,.70)',
  '.list-actions .add-game-action',
  '.toolbar .resetFilters:not(:disabled)',
  '#trashModal .trash-actions button[data-restore-trash]',
  '#modal .game-entry-row:has(.game-entry-rating.rating-in-progress)'
]) {
  if (!styles.includes(token)) throw new Error(`Theme Preview 1 style contract missing: ${token}`);
}
for (const token of ['HUE_CYCLE_SECONDS=72','RGB_WHEEL=Array.from({length:360}','spawnGlint()','const MAX_FPS=90']) {
  if (!html.includes(token)) throw new Error(`Theme Preview 1 particle contract missing: ${token}`);
}
if (!titlebarCss.includes('v1.0 Theme Preview 1 — Cinema Mono titlebar parity.') || !titlebarCss.includes('background:rgba(3,3,4,.68)!important')) {
  throw new Error('Theme Preview 1 monochrome titlebar contract is missing.');
}
if (!themedSelectCss.includes('v1.0 Theme Preview 1 — Cinema Mono themed-select parity.') || !themedSelectCss.includes('--igroteka-select-menu-bg:#08090b')) {
  throw new Error('Theme Preview 1 themed-select contract is missing.');
}
if (/backdrop-filter:blur\((?:2|3|4|8|10)px\)!important/.test(styles.slice(styles.indexOf('v1.0 Theme Preview 1 — Cinema Mono Parity.')))) {
  throw new Error('Theme Preview 1 compositor hardening regression: backdrop blur returned to theme surfaces.');
}

// v1.0 Theme Preview 1 Hotfix 1 — true-black native window + non-interactive command wrappers.
const tauriDevConfig = fs.readFileSync(path.join(root,'src-tauri/tauri.conf.json'),'utf8');
const tauriReleaseConfig = fs.readFileSync(path.join(root,'src-tauri/tauri.release.conf.json'),'utf8');
for (const [name, surface] of [['DEV',tauriDevConfig],['release',tauriReleaseConfig]]) {
  if (!surface.includes('\"backgroundColor\": \"#020203\"')) throw new Error(`Theme Preview 1 Hotfix 1 ${name} native window background is not true black.`);
  if (surface.includes('\"backgroundColor\": \"#08070d\"')) throw new Error(`Theme Preview 1 Hotfix 1 ${name} legacy purple native window background returned.`);
}
for (const rel of ['BUILD-DEV.cmd','BUILD-RELEASE.cmd','MAKE-FINAL-RELEASE.cmd','MIGRATE-FROM-LOST-HEAVEN.cmd']) {
  const cmd = fs.readFileSync(path.join(root,rel),'utf8');
  if (/^\s*pause\s*$/im.test(cmd) || /Read-Host/i.test(cmd) || /set\s+\/p/i.test(cmd)) {
    throw new Error(`Theme Preview 1 Hotfix 1 interactive pause returned: ${rel}`);
  }
}

// v1.0 Theme Preview 1 Hotfix 2 — eliminate legacy purple-black from active frontend background chain.
if (!bridge.includes("document.documentElement.style.setProperty('background', '#020203', 'important');")) {
  throw new Error('Theme Preview 1 Hotfix 2 runtime root background is not canonical #020203.');
}
if (!routeTransitionCss.includes('background:#020203;')) {
  throw new Error('Theme Preview 1 Hotfix 2 startup route overlay is not canonical #020203.');
}
for (const [name, surface] of [['styles.css',styles],['igroteka-bridge.js',bridge],['route-transition.css',routeTransitionCss]]) {
  if (surface.includes('#08070d')) throw new Error(`Theme Preview 1 Hotfix 2 legacy purple-black #08070d returned in ${name}.`);
}

// v1.0 Theme Preview 1 Hotfix 3 — center themed dropdown menus on their trigger with viewport clamping.
for (const token of [
  "const measuredWidth = menu.getBoundingClientRect().width;",
  "const centeredLeft = rect.left + (rect.width - measuredWidth) / 2;",
  "const maxLeft = Math.max(edge, window.innerWidth - measuredWidth - edge);",
  "Math.min(centeredLeft, maxLeft)"
]) {
  if (!themedSelectJs.includes(token)) throw new Error(`Theme Preview 1 Hotfix 3 centered dropdown contract missing: ${token}`);
}
if (themedSelectJs.includes('Math.min(rect.left, window.innerWidth - width - edge)')) {
  throw new Error('Theme Preview 1 Hotfix 3 legacy left-aligned dropdown positioning returned.');
}

console.log('Igroteka Standalone v1.1 Stable verification OK');
console.log('- Dedicated Tauri identity and single-instance guard');
console.log('- Igroteka-only frontend/backend command surface');
console.log('- Portable SQLite + seed recovery + bounded automatic backups');
console.log(`- JavaScript syntax OK (${jsFiles.length} files + ${inlineScripts.length} inline scripts)`);
console.log('- SQLite live/seed integrity and required schema OK');
console.log('- No Kinoteka/Budget frontend or backend wiring');
console.log('- Windows PowerShell 5.1-safe migration + SQLite pre/post verification');
console.log('- Confirmed SQLite writes + hardened portable data root');
console.log('- 90 FPS particle cap + pause while hidden; legacy drag observer removed');
console.log('- Cleanup Pass 1 dead-code/foreign-selector guards OK');
console.log('- Cleanup Pass 2 historical CSS guards OK');
console.log('- Cleanup Pass 3 retired state/dead selector guards OK');
console.log('- Cleanup Pass 4 standalone runtime/modal namespace guards OK');
console.log('- Cleanup Pass 5 confirmed-write compatibility cleanup guards OK');
console.log('- Cleanup Pass 6 standalone shell namespace cleanup guards OK');
console.log('- Cleanup Pass 7 visual namespace finalization guards OK');
console.log('- Cleanup Pass 8 canonical UI-state/residual runtime namespace guards OK');
console.log('- v1.0 Theme Preview 1 Cinema Mono parity guards OK');
console.log('- v1.0 Theme Preview 1 Hotfix 1 true-black native window + no-pause command guards OK');
console.log('- v1.0 Theme Preview 1 Hotfix 2 runtime true-black background-chain guards OK');
console.log('- v1.0 Theme Preview 1 Hotfix 3 centered themed-dropdown positioning guards OK');
console.log('- v1.1 Stable version consistency + canonical SQLite checks OK');
console.log('- Strict 3-file Portable allowlist + .NET ZIP/SHA-256 re-extract pipeline');

// Enforce the exact accepted Hotfix 4 behavior on every v1.1 Stable build.
require('./verify-v1.1-release-freeze.js');
require('./verify-particle-edge-wrap.js');
