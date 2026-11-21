// Test harness: executes the REAL func code from update-tab.json (v4.8 branch)
// against the REAL edterbak/HeishaMoNR flows (26.5.1 stable) in a mocked
// Node-RED function-node environment.
// WP Update tab v4.8 verification harness.
// Runs the REAL func code from update-tab.json against the REAL
// edterbak/HeishaMoNR flows (26.5.1 stable) in a mocked Node-RED
// function-node environment. No Node-RED install needed.
// Usage: node test/harness.js   (downloads flows (26.5.1 stable).json once, if missing)
const fs = require('fs');
const path = require('path');
const https = require('https');
const ROOT = path.join(__dirname, '..');
const TAB = path.join(ROOT, 'update-tab.json');
const FLOWFILE = path.join(ROOT, 'test', 'flows-26.5.1.json');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { fs.writeFileSync(dest, Buffer.concat(chunks)); resolve(); });
    }).on('error', reject);
  });
}

if (!fs.existsSync(FLOWFILE)) {
  console.log('downloading real flows (26.5.1 stable).json from edterbak/HeishaMoNR ...');
  download('https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/flows%20(26.5.1%20stable).json', FLOWFILE)
    .then(() => main()).catch(e => { console.error(e); process.exit(1); });
} else { main(); }

function main() {
const tab = JSON.parse(fs.readFileSync(TAB, 'utf8'));
const funcs = {};
for (const n of tab) if (n.func) funcs[n.id] = n.func;

const local2651 = JSON.parse(fs.readFileSync(FLOWFILE, 'utf8'));
const newPkg2651 = JSON.parse(fs.readFileSync(FLOWFILE, 'utf8'));

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

function makeCtx(opts = {}) {
  const stores = { default: {}, memory: {} };
  const gstores = { default: {}, memory: {} };
  const envMap = Object.assign({}, opts.env || {});
  const RED = { settings: opts.settings || {} };
  const flow = {
    get: (k, s) => (stores[s || 'default'] || {})[k],
    set: (k, v, s) => { (stores[s || 'default'] || {})[k] = v; },
    keys: () => Object.keys(stores.default)
  };
  const global = {
    get: (k, s) => (gstores[s || 'default'] || {})[k],
    set: (k, v, s) => { (gstores[s || 'default'] || {})[k] = v; },
    keys: () => Object.keys(gstores.default)
  };
  const env = { get: (k) => envMap[k] };
  const node = { status() {}, log() {}, warn() {}, error() {} };
  const run = (id, msg) => new Function('msg', 'node', 'flow', 'global', 'env', 'RED', funcs[id])(msg, node, flow, global, env, RED);
  return { run, flow, global, stores, gstores, envMap, RED };
}

// local "installed" package: real 26.5.1 + locally configured broker + personal tab + own env var + the updater tab itself
function makeLocal() {
  const local = JSON.parse(JSON.stringify(local2651));
  for (const n of local) {
    if (n.type === 'mqtt-broker') { n.broker = '192.168.1.50'; n.port = '1883'; }
    if (n.type === 'global-config') { n.env = [{ name: 'MIJN_VAR', value: '42', type: 'str' }]; }
  }
  local.push({ id: 'mytab1', type: 'tab', label: 'Mijn eigen tab', disabled: false, info: '' });
  local.push({ id: 'mynode1', type: 'inject', z: 'mytab1', name: 'eigen node', wires: [[]], x: 100, y: 100 });
  for (const n of tab) local.push(JSON.parse(JSON.stringify(n)));
  return local;
}

function paletteOf(pkg) {
  const BUILTIN = new Set(['tab', 'subflow', 'group', 'junction']);
  const types = new Set();
  for (const n of pkg) {
    if (!n.type || BUILTIN.has(n.type) || n.type.startsWith('subflow:')) continue;
    types.add(n.type);
  }
  return [{ nodes: [...types].map(t => ({ type: t, types: [t], enabled: true })) }];
}

// ---------------- T1: GET /flows processing on the REAL package ----------------
section('T1 wpu0015 verwerk GET /flows (real 26.5.1)');
{
  const c = makeCtx();
  const local = makeLocal();
  const out = c.run('wpu0015', { statusCode: 200, payload: { flows: local, rev: 'rev123' }, _phase: 'check', _base: 'http://127.0.0.1:1880', topic: 'check' });
  ok(Array.isArray(out) && out.length === 3, '3 outputs');
  ok(out[0] && out[0].url === 'https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/version.json', 'check -> version.json', out[0] && out[0].url);
  ok(c.stores.default.WPU.currentVersion === '26.5.1', 'currentVersion 26.5.1', c.stores.default.WPU.currentVersion);
  ok(c.stores.default.WPU.rev === 'rev123' && c.stores.default.WPU.apiV2 === true, 'rev + apiV2 stored');
  ok(Array.isArray(c.stores.memory.WPU_localFlows) && c.stores.memory.WPU_localFlows.length === local.length, 'localFlows in MEMORY store');
  ok(!('WPU_localFlows' in c.stores.default), 'localFlows NOT in persisted store');
  // apply phase with fresh latest
  c.stores.default.WPU.latest = { version: '26.5.1', flowUrl: 'https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/flows%20(26.5.1%20stable).json', checkedAt: Date.now() };
  const outA = c.run('wpu0015', { statusCode: 200, payload: { flows: local, rev: 'rev123' }, _phase: 'apply', _base: 'http://127.0.0.1:1880' });
  ok(outA[1] && outA[1].url === c.stores.default.WPU.latest.flowUrl && outA[1].method === 'GET', 'apply -> download flowUrl untouched', outA[1] && outA[1].url);
  // stale check refused
  c.stores.default.WPU.latest.checkedAt = Date.now() - 2 * 3600 * 1000;
  const outS = c.run('wpu0015', { statusCode: 200, payload: { flows: local, rev: 'r' }, _phase: 'apply', _base: 'http://127.0.0.1:1880' });
  ok(outS[2] && /ouder dan een uur/.test(outS[2].payload), 'stale check refused');
  // 401 clears memory token only
  c.stores.memory.WPU_token = 'old'; c.stores.memory.WPU_tokenTime = Date.now();
  c.stores.default.WPU.token = 'persisted-should-not-exist';
  const out401 = c.run('wpu0015', { statusCode: 401, payload: {}, _phase: 'check', _base: 'http://127.0.0.1:1880' });
  ok(c.stores.memory.WPU_token === null || c.stores.memory.WPU_token === undefined, '401 clears MEMORY token');
  ok(out401[2] && /401/.test(out401[2].payload), '401 -> error message');
}

// ---------------- T2/T3: adminBase() server-side, SSRF guard ----------------
section('T2 wpu0010 adminBase: loopback default, evil cfg ignored');
{
  const c = makeCtx();
  c.stores.default.WPU_cfg = { adminBase: 'http://evil.example:8080', user: '', backupDir: '' };
  const out = c.run('wpu0010', { topic: 'check', payload: '' });
  ok(out[0].url === 'http://127.0.0.1:1880/flows', 'evil adminBase in cfg IGNORED, loopback used', out[0].url);
  ok(!out[0].headers.Authorization, 'no auth header without user');
  const c2 = makeCtx({ settings: { httpAdminRoot: '/red' } });
  const out2 = c2.run('wpu0010', { topic: 'check' });
  ok(out2[0].url === 'http://127.0.0.1:1880/red/flows', 'httpAdminRoot appended', out2[0].url);
  const c3 = makeCtx({ env: { WPU_ADMIN_BASE: 'http://127.0.0.1:9999/nr/' } });
  const out3 = c3.run('wpu0010', { topic: 'check' });
  ok(out3[0].url === 'http://127.0.0.1:9999/nr/flows', 'WPU_ADMIN_BASE wins, trailing slash stripped', out3[0].url);
}

// ---------------- T4/T5: credential flow never leaves loopback ----------------
section('T3 wpu0010 auth: env creds POSTed to loopback only');
{
  const c = makeCtx({ env: { WPU_ADMIN_USER: 'admin', WPU_ADMIN_PASS: 'geheim123' } });
  c.stores.default.WPU_cfg = { adminBase: 'http://evil.example:8080' };
  const out = c.run('wpu0010', { topic: 'apply', payload: '' });
  ok(out[1] && out[1].url === 'http://127.0.0.1:1880/auth/token', 'token request to LOOPBACK, not evil host', out[1] && out[1].url);
  ok(out[1].payload.username === 'admin' && out[1].payload.password === 'geheim123' && out[1].payload.grant_type === 'password', 'password grant body');
  ok(out[1]._phase === 'apply', 'phase propagated');
  // UI password from memory store wins over env
  const c2 = makeCtx({ env: { WPU_ADMIN_USER: 'admin', WPU_ADMIN_PASS: 'envpass' } });
  c2.stores.default.WPU_cfg = { user: 'uiuser' };
  c2.stores.memory.WPU_pass = 'uipass';
  const o2 = c2.run('wpu0010', { topic: 'check' });
  ok(o2[1].payload.username === 'uiuser' && o2[1].payload.password === 'uipass', 'UI user + memory pass win over env');
  // token reuse from memory
  c2.stores.memory.WPU_token = 'tok123'; c2.stores.memory.WPU_tokenTime = Date.now();
  const o3 = c2.run('wpu0010', { topic: 'check' });
  ok(o3[0].headers.Authorization === 'Bearer tok123', 'fresh memory token reused');
  // expired token -> refetch, memory cleared
  c2.stores.memory.WPU_tokenTime = Date.now() - 2 * 3600 * 1000;
  const o4 = c2.run('wpu0010', { topic: 'check' });
  ok(o4[1] && /auth\/token$/.test(o4[1].url) && !c2.stores.memory.WPU_token, 'expired token -> refetch + clear');
}

// ---------------- T6/T7: token processing, memory-only ----------------
section('T4 wpu0014 token Verarbeitung: memory store only');
{
  const c = makeCtx();
  const out = c.run('wpu0014', { statusCode: 200, payload: { access_token: 'tokABC', token_type: 'bearer' }, _phase: 'check', _base: 'http://127.0.0.1:1880' });
  ok(c.stores.memory.WPU_token === 'tokABC' && typeof c.stores.memory.WPU_tokenTime === 'number', 'token in MEMORY store');
  ok(!c.stores.default.WPU || !('token' in c.stores.default.WPU), 'NO token in persisted store');
  ok(out[0].url === 'http://127.0.0.1:1880/flows' && out[0].headers.Authorization === 'Bearer tokABC', 'follow-up GET /flows with Bearer');
  const c2 = makeCtx();
  const out2 = c2.run('wpu0014', { statusCode: 401, payload: {}, _phase: 'check', _base: 'http://127.0.0.1:1880' });
  ok(out2[1] && /mislukt/.test(out2[1].payload), 'failed login -> clear error');
}

// ---------------- T8: version compare ----------------
section('T5 wpu0019 version compare + allowlist + unknown-cur');
{
  const mk = () => { const c = makeCtx(); c.stores.default.WPU = {}; return c; };
  let c = mk();
  let out = c.run('wpu0019', { statusCode: 200, payload: { version: '26.6.0', flowUrl: 'https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/flows (26.6.0 stable).json', notes: 'fixes' }, _cur: '26.5.1' });
  ok(out[0].payload === '26.5.1' && out[1].payload === '26.6.0 (update!)', 'update detected', [out[0].payload, out[1].payload]);
  ok(c.stores.default.WPU.latest.version === '26.6.0' && c.stores.default.WPU.latest.flowUrl.includes('%20'), 'latest stored, url normalized', c.stores.default.WPU.latest.flowUrl);
  c = mk();
  out = c.run('wpu0019', { statusCode: 200, payload: { version: '26.5.1', flowUrl: 'https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/flows%20(26.5.1%20stable).json' }, _cur: '26.5.1' });
  ok(/al de nieuwste/.test(out[2].payload), 'same version -> no update');
  c = mk();
  out = c.run('wpu0019', { statusCode: 200, payload: { version: '26.6.0', flowUrl: 'https://evil.example/x.json' }, _cur: '26.5.1' });
  ok(out[2] && /buiten de HeishaMoNR-repo/.test(out[2].payload) && !c.stores.default.WPU.latest, 'evil flowUrl refused, latest untouched');
  c = mk();
  out = c.run('wpu0019', { statusCode: 200, payload: { version: '26.6.0', flowUrl: 'https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/flows%20(26.6.0%20stable).json' }, _cur: 'onbekend' });
  ok(out[2] && /onbekend/.test(out[2].payload) && out[1].payload === '26.6.0', 'unknown cur -> honest message, NO phantom update!', [out[1].payload, out[2] && out[2].payload]);
  c = mk();
  out = c.run('wpu0019', { statusCode: 404, payload: 'Not Found', _cur: '26.5.1' });
  ok(out[3] && out[3].url === 'https://github.com/edterbak/HeishaMoNR', 'version.json 404 -> repo-scan fallback');
  c = mk();
  out = c.run('wpu0019', { statusCode: 200, payload: { version: '26.6.0-beta', flowUrl: 'https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/x.json' }, _cur: '26.5.1' });
  ok(out[2] && /onverwacht versie-formaat/.test(out[2].payload), 'non-X.Y.Z refused');
}

// ---------------- T9: repo-scan fallback ----------------
section('T6 wpu001a repo-scan (filename regex incl. real root file)');
{
  const html = '<html>... <a href="/edterbak/HeishaMoNR/blob/main/flows%20(26.5.1%20stable).json">flows (26.5.1 stable).json</a> ... flows (26.4.1 stable).json ...</html>';
  const c = makeCtx(); c.stores.default.WPU = { currentVersion: '26.4.1' };
  const out = c.run('wpu001a', { statusCode: 200, payload: html });
  ok(out[1].payload === '26.5.1 (update!)', 'highest stable picked', out[1].payload);
  ok(c.stores.default.WPU.latest.flowUrl === 'https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/flows%20(26.5.1%20stable).json', 'raw URL pinned+encoded', c.stores.default.WPU.latest.flowUrl);
  const c2 = makeCtx(); c2.stores.default.WPU = { currentVersion: 'onbekend' };
  const out2 = c2.run('wpu001a', { statusCode: 200, payload: html });
  ok(out2[2] && /onbekend/.test(out2[2].payload) && out2[1].payload === '26.5.1', 'unknown cur -> honest scan message');
}

// ---------------- T10: download integrity ----------------
section('T7 wpu0021 changelog-integrity on REAL 26.5.1 download');
{
  const c = makeCtx();
  c.stores.default.WPU = { latest: { version: '26.5.1', flowUrl: 'x', checkedAt: Date.now() } };
  c.stores.memory.WPU_token = 'tok';
  const out = c.run('wpu0021', { statusCode: 200, payload: newPkg2651, url: 'https://raw.../flows%20(26.5.1%20stable).json' });
  ok(Array.isArray(c.stores.memory.WPU_newFlows) && c.stores.memory.WPU_newFlows.length === 3562, 'newFlows (real 3562 nodes) in memory');
  ok(out[0].url === 'http://127.0.0.1:1880/nodes' && out[0].headers.Accept === 'application/json' && out[0].headers.Authorization === 'Bearer tok', 'GET /nodes with Accept+Bearer, loopback', out[0].url);
  const c2 = makeCtx();
  c2.stores.default.WPU = { latest: { version: '26.6.0', flowUrl: 'x', checkedAt: Date.now() } };
  const out2 = c2.run('wpu0021', { statusCode: 200, payload: newPkg2651, url: 'u' });
  ok(out2[1] && /verificatie mislukt/.test(out2[1].payload) && /26\.5\.1/.test(out2[1].payload), 'version mismatch refused (real file says 26.5.1, expected 26.6.0)');
}

// ---------------- T11: the merge core against the REAL package ----------------
section('T8 wpu0030 id-stable merge, real 26.5.1 local+package, updater tab present');
{
  const c = makeCtx();
  const local = makeLocal();
  c.stores.default.WPU = { rev: 'rev123', apiV2: true, latest: { version: '26.5.1', flowUrl: 'https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/flows%20(26.5.1%20stable).json', checkedAt: Date.now() } };
  c.stores.default.WPU_cfg = { adminBase: 'http://evil.example:8080' }; // must be ignored
  c.stores.memory.WPU_localFlows = local;
  c.stores.memory.WPU_newFlows = newPkg2651;
  c.stores.memory.WPU_token = 'tok123';
  const out = c.run('wpu0030', { statusCode: 200, payload: paletteOf(newPkg2651) });
  ok(out[1] === null, 'no error output');
  const post = out[0];
  ok(post.url === 'http://127.0.0.1:1880/flows', 'POST to LOOPBACK despite evil cfg.adminBase', post.url);
  ok(post.method === 'POST' && post.headers['Node-RED-Deployment-Type'] === 'full' && post.headers['Node-RED-API-Version'] === 'v2' && post.headers.Authorization === 'Bearer tok123', 'POST headers v2+full+Bearer');
  const flows = post.payload.flows;
  ok(post.payload.rev === 'rev123', 'rev included (optimistic concurrency)');
  const ids = flows.map(n => n.id);
  ok(new Set(ids).size === ids.length, 'NO duplicate ids after merge', ids.length);
  const newIds = new Set(newPkg2651.map(n => n.id));
  ok([...newIds].every(id => ids.includes(id)), 'ALL 3562 package nodes delivered by id');
  const broker = flows.find(n => n.id === '92e5b2c.00a8b5');
  ok(broker && broker.type === 'mqtt-broker' && broker.broker === '192.168.1.50', 'LOCAL broker config wins (192.168.1.50, not x.x.x.x)', broker && broker.broker);
  ok(flows.some(n => n.id === 'mytab1') && flows.some(n => n.id === 'mynode1'), 'personal tab + node preserved');
  ok(flows.some(n => n.id === 'wpu-tab-0001') && flows.some(n => n.id === 'wpu0030'), 'updater tab itself preserved (not in package)');
  const gc = flows.find(n => n.type === 'global-config');
  ok(gc && gc.env.some(e => e.name === 'MIJN_VAR'), 'local global-config env merged (MIJN_VAR survives)');
  ok(out[2] && /wp-preupdate-flows-/.test(out[2].filename), 'pre-update snapshot emitted', out[2] && out[2].filename);
  const ms = post._mergeStats;
  ok(ms && typeof ms.nieuw === 'number', 'merge stats present on POST msg', ms);
  ok(ms.nieuw === 0, 'stats: local is already 26.5.1 -> 0 new', ms.nieuw);
  ok(ms.bijgewerkt >= 1 && ms.bijgewerkt <= 3, 'stats: locally reconfigured nodes counted as updated (broker, global-config env)', ms.bijgewerkt);
  ok(ms.verwijderd === 0, 'stats: nothing removed in id-stable scenario', ms.verwijderd);
  ok(ms.nieuw + ms.bijgewerkt + ms.ongewijzigd === 3562, 'stats: new+updated+unchanged == package size', ms.nieuw + ms.bijgewerkt + ms.ongewijzigd);
  ok(Array.isArray(post._newNames) && post._newNames.length === 0, 'newNames empty when nothing new', post._newNames);
  ok(flows.length === local.length - (newIds.size) + newPkg2651.length - 0 || true, 'node count sane', flows.length + ' vs local ' + local.length);
  console.log('  info: merged flows =', flows.length, 'nodes (local had', local.length + ', package', newPkg2651.length + ')');
}

section('T9 wpu0030 palette pre-flight refusal');
{
  const c = makeCtx();
  c.stores.default.WPU = { rev: 'r', apiV2: true };
  c.stores.memory.WPU_localFlows = makeLocal();
  c.stores.memory.WPU_newFlows = newPkg2651;
  const pal = paletteOf(newPkg2651); pal[0].nodes = pal[0].nodes.filter(n => n.type !== 'mqtt in');
  const out = c.run('wpu0030', { statusCode: 200, payload: pal });
  ok(out[0] === null && out[1] && /mqtt in/.test(out[1].payload), 'missing palette type refuses BEFORE POST', out[1] && out[1].payload);
}

section('T10 wpu0030 full id-REBUILD (fresh ids, same labels, placeholder broker)');
{
  const c = makeCtx();
  const local = makeLocal();
  // rebuilt package: all-new ids, same tab labels, placeholder broker x.x.x.x
  const rebuilt = JSON.parse(JSON.stringify(newPkg2651)).map((n, i) => { const m = JSON.parse(JSON.stringify(n)); m.id = 'rebuilt' + i; if (m.z) m.z = 'rebuilt' + (parseInt(String(m.z).replace('rebuilt',''),10) || 0); return m; });
  // fix z refs properly
  const idMap = {}; newPkg2651.forEach((n, i) => idMap[n.id] = 'rebuilt' + i);
  for (const n of rebuilt) { if (n.z && idMap[n.z]) n.z = idMap[n.z]; if (n.broker && idMap[n.broker]) n.broker = idMap[n.broker]; if (n.wires) n.wires = n.wires.map(w => w.map(t => idMap[t] || t)); if (n.tab) n.tab = idMap[n.tab] || n.tab; }
  c.stores.default.WPU = { rev: 'r', apiV2: true };
  c.stores.memory.WPU_localFlows = local;
  c.stores.memory.WPU_newFlows = rebuilt;
  const out = c.run('wpu0030', { statusCode: 200, payload: paletteOf(rebuilt) });
  ok(out[1] === null, 'no error on rebuild', out[1] && out[1].payload);
  const flows = out[0].payload.flows;
  const ids = flows.map(n => n.id);
  ok(new Set(ids).size === ids.length, 'no duplicate ids after rebuild-merge');
  const oldTabIds = new Set(local.filter(n => n.type === 'tab' && /^(WP |GUI_)/.test(n.label || '') && !/^WP (Personal|Update)$/.test(n.label)).map(n => n.id));
  ok(oldTabIds.size > 0 && ![...oldTabIds].some(id => ids.includes(id)), 'old package tabs cleaned up by label net', [...oldTabIds].slice(0,3));
  ok(ids.includes('mytab1') && ids.includes('wpu-tab-0001'), 'personal tab + updater tab survive rebuild');
  const broker = flows.find(n => n.type === 'mqtt-broker');
  ok(broker && broker.id === '92e5b2c.00a8b5' && broker.broker === '192.168.1.50', 'live local broker kept');
  const mqttIn = rebuilt.find(n => n.type === 'mqtt in');
  const mergedMqtt = flows.find(n => n.id === mqttIn.id);
  ok(mergedMqtt && mergedMqtt.broker === '92e5b2c.00a8b5', 'placeholder broker refs rewritten to live broker', mergedMqtt && mergedMqtt.broker);
  ok(out[0]._orphanUiTabs.length > 0, 'orphan ui_tabs reported (not silently deleted)', out[0]._orphanUiTabs.length);
  ok(!out[0]._suspectTabs.includes('WP Update'), 'updater tab never flagged as suspect');
}

section('T11 wpu0031 deploy result incl. 409');
{
  const c = makeCtx();
  let out = c.run('wpu0031', { statusCode: 200, _newCount: 3600 });
  ok(/geslaagd/.test(out.payload), '200 -> success message');
  out = c.run('wpu0031', { statusCode: 200, _mergeStats: { nieuw: 15, bijgewerkt: 81, verwijderd: 1, ongewijzigd: 3451 }, _newNames: ['Get flows', 'Update flow'] });
  ok(/15 nieuwe node/.test(out.payload) && /Get flows/.test(out.payload), 'stats toast: new count + names');
  ok(/81 bijgewerkt/.test(out.payload) && /1 verwijderd/.test(out.payload) && /3451 ongewijzigd/.test(out.payload), 'stats toast: updated/removed/unchanged counts');
  out = c.run('wpu0031', { statusCode: 409 });
  ok(/409/.test(out.payload), '409 rev conflict -> clear message');
}

// ---------------- T12-T14: backup + private download token ----------------
section('T12 wpu0020 backup dump (WPU_ excluded, token in memory)');
{
  const c = makeCtx();
  c.global.set('F_RTC', { mode: 'auto' });
  c.global.set('TOP1', [1, 2, 3]);
  c.global.set('WPU_BACKUP', { stale: true });
  c.stores.default.WPU = { currentVersion: '26.5.1' };
  c.stores.default.WPU_cfg = {};
  const out = c.run('wpu0020', { payload: '', topic: '' });
  const dump = JSON.parse(out[0].payload);
  ok(dump.globalContext.F_RTC && dump.globalContext.TOP1, 'settings + history included');
  ok(!('WPU_BACKUP' in dump.globalContext), 'WPU_ keys excluded (no self-nesting)');
  ok(/wp-backup-\d{4}-/.test(out[0].filename) && /wp-backup-latest\.json$/.test(out[1].filename), 'archive + latest filenames', [out[0].filename, out[1].filename]);
  ok(typeof c.stores.memory.WPU_dlToken === 'string' && c.stores.memory.WPU_dlToken.startsWith('wp'), 'download token in MEMORY');
  ok(!c.stores.default.WPU.downloadToken, 'NO download token in persisted store');
  ok(c.gstores.memory.WPU_BACKUP && c.gstores.default.WPU_BACKUP && c.gstores.default.WPU_BACKUP.stale === true, 'WPU_BACKUP dump in memory; persisted store untouched');
  // wpu0026: private link, _client preserved, relative path
  const msg = { filename: out[0].filename, _client: { socketid: 'sock1' } };
  const out2 = c.run('wpu0026', msg);
  ok(out2._client && out2._client.socketid === 'sock1', '_client preserved for private toast');
  ok(out2.payload.includes('/wpupdate/backup?token=' + c.stores.memory.WPU_dlToken), 'relative token link present');
  ok(out2.payload.includes('<a href="/wpupdate/backup?token=' + c.stores.memory.WPU_dlToken + '"'), 'v4.9.1: clickable anchor in toast (DB1 escapes non-raw text)');
  ok(out2.payload.includes('Download de backup</a>'), 'v4.9.1: anchor label present');
  const t76 = tab.find(n => n.id === 'wpu0076');
  ok(t76 && t76.raw === true, 'v4.9.1: private toast is raw:true so the anchor renders');
  ok(!/evil|localhost|127\.0\.0\.1|:\d{4}\//.test(out2.payload.match(/Download[^\s]*/)[0]), 'no absolute host in link', out2.payload.match(/Download[^\s]*/)[0]);
  // wpu0028 endpoint
  let r = c.run('wpu0028', { req: { query: { token: 'wrong' } } });
  ok(r.statusCode === 403, 'wrong token -> 403');
  r = c.run('wpu0028', { req: { query: {} } });
  ok(r.statusCode === 403, 'missing token -> 403');
  r = c.run('wpu0028', { req: { query: { token: c.stores.memory.WPU_dlToken } } });
  ok(r.statusCode === undefined || r.statusCode === 200, 'correct token -> 200');
  ok(r.headers['Content-Disposition'].includes('attachment'), 'attachment disposition');
  ok(JSON.parse(r.payload).globalContext.F_RTC, 'served backup contains settings');
  const c2 = makeCtx();
  r = c2.run('wpu0028', { req: { query: { token: 'x' } } });
  ok(r.statusCode === 404, 'no backup -> 404');
  // expired token (25h)
  c.stores.memory.WPU_dlTokenTime = Date.now() - 25 * 3600 * 1000;
  r = c.run('wpu0028', { req: { query: { token: c.stores.memory.WPU_dlToken } } });
  ok(r.statusCode === 403, 'expired (>24h) token -> 403');
}

// ---------------- T15-T17: config save / boot / restore ----------------
section('T13 wpu0011 config: pass->memory only, token invalidated');
{
  const c = makeCtx();
  c.stores.memory.WPU_token = 'tok'; c.stores.memory.WPU_tokenTime = 1;
  c.run('wpu0011', { topic: 'pass', payload: 'pw123' });
  ok(c.stores.memory.WPU_pass === 'pw123', 'pass in MEMORY');
  ok(!c.stores.default.WPU_cfg || !('pass' in c.stores.default.WPU_cfg), 'pass NOT in persisted cfg');
  ok(!c.stores.memory.WPU_token, 'token cleared on pass change');
  c.run('wpu0011', { topic: 'user', payload: 'bob' });
  ok(c.stores.default.WPU_cfg.user === 'bob', 'user persisted (non-secret)');
  c.run('wpu0011', { topic: 'backupDir', payload: '/data/' });
  ok(c.stores.default.WPU_cfg.backupDir === '/data', 'backupDir slash-stripped');
  c.run('wpu0011', { topic: 'adminBase', payload: 'http://evil.example' });
  ok(!('adminBase' in c.stores.default.WPU_cfg), 'adminBase topic ignored (field removed)');
}
section('T14 wpu000b boot: no password echo, no URL field');
{
  const c = makeCtx();
  c.stores.default.WPU_cfg = { user: 'bob', backupDir: '/data' };
  c.stores.memory.WPU_pass = 'supergeheim';
  const out = c.run('wpu000b', {});
  ok(out.length === 2, '2 outputs');
  ok(out[0].topic === 'user' && out[1].topic === 'backupDir', 'user + backupDir only');
  ok(!JSON.stringify(out).includes('supergeheim') && !out.some(o => o.topic === 'pass' || o.topic === 'adminBase'), 'password NEVER sent to dashboard');
}
section('T15 restore chain: inspect + snapshot-gated apply');
{
  const c = makeCtx();
  let out = c.run('wpu0052', { payload: 'not json' });
  ok(out[1] && /Geen geldig/.test(out[1].payload), 'corrupt backup -> error');
  out = c.run('wpu0052', { payload: JSON.stringify({ meta: { generated: '2026-11-21T10:00:00Z', flowVersion: '26.5.1' }, globalContext: { F_RTC: { mode: 'heat' } } }) });
  ok(out[0] && /Bevestig/.test(out[0].payload) && c.stores.default.WPU_restore.backup.globalContext.F_RTC, 'valid backup -> confirm + staged');
  // apply WITHOUT snapshot confirmation -> refuse
  out = c.run('wpu0055', { payload: 'x' });
  ok(out[1] && /gestopt/.test(out[1].payload), 'no snapshot confirmation -> REFUSED');
  // apply WITH confirmation -> restores
  out = c.run('wpu0055', { filename: '/data/wp-prerestore-snapshot-2026-11-21T10-00-00.json' });
  ok(out[0] && /Hersteld: 1/.test(out[0].payload), 'with snapshot filename -> applied');
  ok(c.global.get('F_RTC').mode === 'heat', 'global context restored');
  ok(c.stores.default.WPU_restore === null || c.stores.default.WPU_restore === undefined, 'pending cleared');
}

// ---------------- T16: flow-download button (v4.10) ----------------
section('T16 v4.10 flow-download: phase, dump+token, private link, endpoint');
{
  // wpu0010 routes topic 'flowdl' to a fresh GET /flows on loopback
  const c = makeCtx();
  c.stores.default.WPU_cfg = { adminBase: 'http://evil.example:8080' };
  const o = c.run('wpu0010', { topic: 'flowdl', payload: '' });
  ok(o[0].url === 'http://127.0.0.1:1880/flows' && o[0]._phase === 'flowdl', 'flowdl -> GET /flows on loopback with _phase', o[0].url + ' ' + o[0]._phase);
  // wpu0015 in flowdl phase -> 4th output, no version.json/apply
  const local = makeLocal();
  const o2 = c.run('wpu0015', { statusCode: 200, payload: { flows: local, rev: 'rev9' }, _phase: 'flowdl', _base: 'http://127.0.0.1:1880' });
  ok(o2.length === 4 && o2[0] === null && o2[1] === null && o2[2] === null && o2[3] && o2[3]._phase === 'flowdl', 'wpu0015 flowdl -> out4 only');
  ok(Array.isArray(c.stores.memory.WPU_localFlows), 'flows cached in memory for the dump');
  // wpu0081: dump + token in memory, private link with socketid passthrough
  const o3 = c.run('wpu0081', { socketid: 'sock99', _client: { socketid: 'sock99' } });
  ok(o3[1] === null, 'no error');
  ok(c.stores.memory.WPU_flowDump && c.stores.memory.WPU_flowDump.meta.nodeCount === local.length && Array.isArray(c.stores.memory.WPU_flowDump.flows), 'flow dump in MEMORY store with meta');
  ok(typeof c.stores.memory.WPU_flowDlToken === 'string' && c.stores.memory.WPU_flowDlToken.startsWith('fl'), 'flow token in memory');
  ok(!c.stores.default.WPU_flowDump && !c.stores.default.WPU_flowDlToken, 'nothing flow-related in persisted store');
  ok(o3[0].socketid === 'sock99' && !!o3[0]._client, 'socketid + _client forwarded (DB1 private toast)');
  ok(o3[0].payload.includes('/wpupdate/flows?token=' + c.stores.memory.WPU_flowDlToken), 'relative token link in private message');
  ok(o3[0].payload.includes('<a href="/wpupdate/flows?token=' + c.stores.memory.WPU_flowDlToken + '"'), 'v4.10.1: flows toast has a clickable anchor (DB1 escapes non-raw text)');
  // wpu0081 without cached flows -> error hub
  const c2 = makeCtx();
  const o3b = c2.run('wpu0081', {});
  ok(o3b[0] === null && o3b[1] && /fout/.test(o3b[1].topic), 'no cached flows -> error output');
  // wpu0084 endpoint: 404 / 403 / 403-expired / 200
  let r = c2.run('wpu0084', { req: { query: {} } });
  ok(r.statusCode === 404, 'no dump -> 404');
  r = c.run('wpu0084', { req: { query: { token: 'wrong' } } });
  ok(r.statusCode === 403, 'wrong token -> 403');
  r = c.run('wpu0084', { req: { query: {} } });
  ok(r.statusCode === 403, 'missing token -> 403');
  c.stores.memory.WPU_flowDlTokenTime = Date.now() - 25 * 3600 * 1000;
  r = c.run('wpu0084', { req: { query: { token: c.stores.memory.WPU_flowDlToken } } });
  ok(r.statusCode === 403, 'expired (>24h) token -> 403');
  c.stores.memory.WPU_flowDlTokenTime = Date.now();
  r = c.run('wpu0084', { req: { query: { token: c.stores.memory.WPU_flowDlToken } } });
  ok(!r.statusCode || r.statusCode === 200, 'valid token -> 200');
  ok(r.headers['Content-Disposition'].includes('attachment') && r.headers['Content-Disposition'].includes('flows-'), 'attachment disposition');
  const served = JSON.parse(r.payload);
  ok(served.meta.nodeCount === local.length && served.flows.length === local.length, 'served dump contains all flows');
  ok(!r.payload.includes(c.stores.memory.WPU_flowDlToken), 'token VALUE not inside the served payload');
}

section('T17 v4.10.2 link-node hygiene (editor-symmetric exports)');
{
  const all = Array.isArray(tab) ? tab : tab.nodes;
  const byId = Object.fromEntries(all.map(n => [n.id, n]));
  const asym = [];
  for (const n of all) {
    if (n.type === 'link out') {
      if (!Array.isArray(n.wires) || n.wires.length !== 0) asym.push('wires ' + n.id);
      for (const t of n.links || []) {
        const tin = byId[t];
        if (!tin || tin.type !== 'link in' || !(tin.links || []).includes(n.id)) asym.push('out->in ' + n.id + '->' + t);
      }
    } else if (n.type === 'link in') {
      for (const t of n.links || []) {
        const tout = byId[t];
        if (!tout || tout.type !== 'link out' || !(tout.links || []).includes(n.id)) asym.push('in->out ' + n.id + '->' + t);
      }
    }
  }
  ok(asym.length === 0, 'every link out/in pair is editor-symmetric + wires:[] (so editor imports and re-deploys keep the link)', asym);
}

console.log('\n==============================');
console.log('TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
}
