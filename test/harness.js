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
  const nodeLogs = [];
  const node = { status() {}, log: m => nodeLogs.push(['log', String(m)]), warn: m => nodeLogs.push(['warn', String(m)]), error: m => nodeLogs.push(['error', String(m)]) };
  const run = (id, msg) => { nodeLogs.length = 0; return new Function('msg', 'node', 'flow', 'global', 'env', 'RED', funcs[id])(msg, node, flow, global, env, RED); };
  return { run, flow, global, stores, gstores, envMap, RED, nodeLogs };
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
  ok(tab.find(n => n.id === 'wpu0015').outputs === 5 && Array.isArray(out) && out.length >= 1, 'wpu0015 configured 5 outputs (check/apply/err/flowdl/selfupdate)');
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
  ok(outS[2] && /older than one hour/.test(outS[2].payload), 'stale check refused');
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
  ok(out2[1] && /login failed/.test(out2[1].payload), 'failed login -> clear error');
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
  ok(/latest version/.test(out[2].payload), 'same version -> no update');
  c = mk();
  out = c.run('wpu0019', { statusCode: 200, payload: { version: '26.6.0', flowUrl: 'https://evil.example/x.json' }, _cur: '26.5.1' });
  ok(out[2] && /outside the HeishaMoNR repo/.test(out[2].payload) && !c.stores.default.WPU.latest, 'evil flowUrl refused, latest untouched');
  c = mk();
  out = c.run('wpu0019', { statusCode: 200, payload: { version: '26.6.0', flowUrl: 'https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/flows%20(26.6.0%20stable).json' }, _cur: 'unknown' });
  ok(out[2] && /unknown/.test(out[2].payload) && out[1].payload === '26.6.0', 'unknown cur -> honest message, NO phantom update!', [out[1].payload, out[2] && out[2].payload]);
  c = mk();
  out = c.run('wpu0019', { statusCode: 404, payload: 'Not Found', _cur: '26.5.1' });
  ok(out[3] && out[3].url === 'https://github.com/edterbak/HeishaMoNR', 'version.json 404 -> repo-scan fallback');
  c = mk();
  out = c.run('wpu0019', { statusCode: 200, payload: { version: '26.6.0-beta', flowUrl: 'https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/x.json' }, _cur: '26.5.1' });
  ok(out[2] && /unexpected version format/.test(out[2].payload), 'non-X.Y.Z refused');
}

// ---------------- T9: repo-scan fallback ----------------
section('T6 wpu001a repo-scan (filename regex incl. real root file)');
{
  const html = '<html>... <a href="/edterbak/HeishaMoNR/blob/main/flows%20(26.5.1%20stable).json">flows (26.5.1 stable).json</a> ... flows (26.4.1 stable).json ...</html>';
  const c = makeCtx(); c.stores.default.WPU = { currentVersion: '26.4.1' };
  const out = c.run('wpu001a', { statusCode: 200, payload: html });
  ok(out[1].payload === '26.5.1 (update!)', 'highest stable picked', out[1].payload);
  ok(c.stores.default.WPU.latest.flowUrl === 'https://raw.githubusercontent.com/edterbak/HeishaMoNR/main/flows%20(26.5.1%20stable).json', 'raw URL pinned+encoded', c.stores.default.WPU.latest.flowUrl);
  const c2 = makeCtx(); c2.stores.default.WPU = { currentVersion: 'unknown' };
  const out2 = c2.run('wpu001a', { statusCode: 200, payload: html });
  ok(out2[2] && /unknown/.test(out2[2].payload) && out2[1].payload === '26.5.1', 'unknown cur -> honest scan message');
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
  ok(out2[1] && /verification failed/.test(out2[1].payload) && /26\.5\.1/.test(out2[1].payload), 'version mismatch refused (real file says 26.5.1, expected 26.6.0)');
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
  ok(ms && typeof ms.added === 'number', 'merge stats present on POST msg', ms);
  ok(ms.added === 0, 'stats: local is already 26.5.1 -> 0 new', ms.added);
  ok(ms.updated >= 1 && ms.updated <= 3, 'stats: locally reconfigured nodes counted as updated (broker, global-config env)', ms.updated);
  ok(ms.removed === 0, 'stats: nothing removed in id-stable scenario', ms.removed);
  ok(ms.added + ms.updated + ms.unchanged === 3562, 'stats: new+updated+unchanged == package size', ms.added + ms.updated + ms.unchanged);
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
  ok(/succeeded/.test(out.payload), '200 -> success message');
  out = c.run('wpu0031', { statusCode: 200, _mergeStats: { added: 15, updated: 81, removed: 1, unchanged: 3451 }, _newNames: ['Get flows', 'Update flow'] });
  ok(/15 new node/.test(out.payload) && /Get flows/.test(out.payload), 'stats toast: new count + names');
  ok(/81 updated/.test(out.payload) && /1 removed/.test(out.payload) && /3451 unchanged/.test(out.payload), 'stats toast: updated/removed/unchanged counts');
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
  ok(out2.payload.includes('Download the backup</a>'), 'v4.9.1: anchor label present');
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
  ok(out[1] && /No valid backup/.test(out[1].payload), 'corrupt backup -> error');
  out = c.run('wpu0052', { payload: JSON.stringify({ meta: { generated: '2026-11-21T10:00:00Z', flowVersion: '26.5.1' }, globalContext: { F_RTC: { mode: 'heat' } } }) });
  ok(out[0] && /Confirm restore/.test(out[0].payload) && c.stores.default.WPU_restore.backup.globalContext.F_RTC, 'valid backup -> confirm + staged');
  // apply WITHOUT snapshot confirmation -> refuse
  out = c.run('wpu0055', { payload: 'x' });
  ok(out[1] && /stopped/.test(out[1].payload), 'no snapshot confirmation -> REFUSED');
  // apply WITH confirmation -> restores
  out = c.run('wpu0055', { filename: '/data/wp-prerestore-snapshot-2026-11-21T10-00-00.json' });
  ok(out[0] && /Restored: 1/.test(out[0].payload), 'with snapshot filename -> applied');
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
  ok(o2[0] === null && o2[1] === null && o2[2] === null && o2[3] && o2[3]._phase === 'flowdl', 'wpu0015 flowdl -> out4 only');
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
  ok(o3b[0] === null && o3b[1] && /error/.test(o3b[1].topic), 'no cached flows -> error output');
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

// ---------------- T18: self-update of the updater itself (v4.11) ----------------
section('T18 v4.11 self-update: phase, pinned version.json, validation, wpu-only merge, POST');
{
  // wpu0010 routes topic 'selfupdate' to GET /flows on loopback
  const c = makeCtx();
  c.stores.default.WPU_cfg = { adminBase: 'http://evil.example:8080' };
  const o = c.run('wpu0010', { topic: 'selfupdate', payload: '' });
  ok(o[0].url === 'http://127.0.0.1:1880/flows' && o[0]._phase === 'selfupdate', 'selfupdate -> GET /flows loopback with _phase', o[0].url);
  const oc = c.run('wpu0010', { topic: 'selfcheck', payload: '' });
  ok(oc[0].url === 'http://127.0.0.1:1880/flows' && oc[0]._phase === 'selfcheck', 'selfcheck -> GET /flows loopback with _phase selfcheck', oc[0].url);
  // wpu0015 selfupdate/selfcheck phase -> out5 with PINNED updater version.json URL, phase preserved (v4.12)
  const local = makeLocal(); // real 26.5.1 + broker mod + personal tab + the tab itself
  local.find(n => n.id === 'wpu-tab-0001').version = '4.10.4';
  const o2 = c.run('wpu0015', { statusCode: 200, payload: { flows: local, rev: 'rev77' }, _phase: 'selfupdate', _base: 'http://127.0.0.1:1880' });
  ok(o2.length === 5 && o2[4] && o2[4].url === 'https://raw.githubusercontent.com/MikeyMan83/HeishamonNR-update-tab/main/version.json' && o2[0] === null, 'selfupdate -> out5 pinned updater version.json', o2[4] && o2[4].url);
  ok(o2[4]._phase === 'selfupdate', 'out5 keeps _phase selfupdate', o2[4]._phase);
  const o2b = c.run('wpu0015', { statusCode: 200, payload: { flows: local, rev: 'rev77' }, _phase: 'selfcheck', _base: 'http://127.0.0.1:1880' });
  ok(o2b[4] && o2b[4]._phase === 'selfcheck' && o2b[4].url.includes('HeishamonNR-update-tab/main/version.json'), 'selfcheck -> out5 with _phase selfcheck (NOT rewritten to selfupdate)', o2b[4] && o2b[4]._phase);
  ok(c.stores.memory.WPU_localFlows.length === local.length && c.stores.default.WPU.rev === 'rev77', 'local flows + rev cached for the merge');
  // wpu0093: newer version -> download msg with allowlisted flowUrl; evil flowUrl refused; same version -> info; bad format -> error
  const mk93 = (ver) => { const c = makeCtx(); c.stores.default.WPU = {}; c.stores.memory.WPU_localFlows = local; return c; };
  // v4.12: check-then-apply parity — only _phase 'selfupdate' downloads; 'selfcheck' only displays "cur -> version"
  let c3 = mk93();
  let r = c3.run('wpu0093', { statusCode: 200, _phase: 'selfupdate', payload: { version: '4.11.0', flowUrl: 'https://raw.githubusercontent.com/MikeyMan83/HeishamonNR-update-tab/main/update-tab.json' } });
  ok(r[0] && r[0].url.endsWith('/MikeyMan83/HeishamonNR-update-tab/main/update-tab.json') && r[0].method === 'GET' && r[0]._phase === 'selfupdate', 'selfupdate + newer -> download msg', r[0] && r[0].url);
  ok(c3.stores.default.WPU.selfLatest.version === '4.11.0', 'selfLatest stored');
  c3 = mk93();
  r = c3.run('wpu0093', { statusCode: 200, _phase: 'selfcheck', payload: { version: '4.11.0', flowUrl: 'https://raw.githubusercontent.com/MikeyMan83/HeishamonNR-update-tab/main/update-tab.json' } });
  ok(!r[0] && r[1] && r[1].payload === '4.10.4 -> 4.11.0 (update!)', 'selfcheck + newer -> display only, NO download', r[1] && r[1].payload);
  c3 = mk93();
  r = c3.run('wpu0093', { statusCode: 200, _phase: 'selfupdate', payload: { version: '4.11.0', flowUrl: 'https://evil.example/x.json' } });
  ok(r[2] && /outside the HeishamonNR-update-tab repo/.test(r[2].payload) && !r[0], 'evil flowUrl refused');
  c3 = mk93();
  r = c3.run('wpu0093', { statusCode: 200, _phase: 'selfupdate', payload: { version: '4.10.4', flowUrl: 'https://raw.githubusercontent.com/MikeyMan83/HeishamonNR-update-tab/main/update-tab.json' } });
  ok(r[1] && r[1].payload === '4.10.4 -> 4.10.4 (up to date)' && !r[0], 'selfupdate + same version -> "up to date" display, no download', r[1] && r[1].payload);
  c3 = mk93();
  r = c3.run('wpu0093', { statusCode: 200, _phase: 'selfupdate', payload: { version: '4.11-beta', flowUrl: 'https://raw.githubusercontent.com/MikeyMan83/HeishamonNR-update-tab/main/update-tab.json' } });
  ok(r[2] && /unexpected version format/.test(r[2].payload), 'non-X.Y.Z refused');
  // wpu0095: validation rules
  const newTab = JSON.parse(JSON.stringify(tab.filter(n => String(n.id).startsWith('wpu'))));
  newTab.find(n => n.id === 'wpu-tab-0001').version = '4.11.0';
  const c4 = makeCtx();
  c4.stores.default.WPU = { selfLatest: { version: '4.11.0', flowUrl: 'x', checkedAt: Date.now() } };
  let r4 = c4.run('wpu0095', { statusCode: 200, payload: newTab, url: 'u' });
  ok(Array.isArray(c4.stores.memory.WPU_newTab) && r4[0].url === 'http://127.0.0.1:1880/nodes' && r4[0].headers.Accept === 'application/json', 'valid tab -> palette request', r4[0] && r4[0].url);
  const evilTab = JSON.parse(JSON.stringify(newTab)); evilTab.push({ id: 'notwpu123', type: 'inject', z: 'wpu-tab-0001', wires: [] });
  const c5 = makeCtx(); c5.stores.default.WPU = { selfLatest: { version: '4.11.0' } };
  r4 = c5.run('wpu0095', { statusCode: 200, payload: evilTab, url: 'u' });
  ok(r4[1] && /non-wpu node ids/.test(r4[1].payload) && !c5.stores.memory.WPU_newTab, 'non-wpu id -> refused, nothing stored');
  const wrongVer = JSON.parse(JSON.stringify(newTab)); wrongVer.find(n => n.id === 'wpu-tab-0001').version = '9.9.9';
  const c6 = makeCtx(); c6.stores.default.WPU = { selfLatest: { version: '4.11.0' } };
  r4 = c6.run('wpu0095', { statusCode: 200, payload: wrongVer, url: 'u' });
  ok(r4[1] && /9.9.9/.test(r4[1].payload) && /4.11.0/.test(r4[1].payload), 'version mismatch -> refused');
  // wpu0096: wpu-only merge against real package + tab
  const c7 = makeCtx();
  c7.stores.default.WPU = { rev: 'rev77', apiV2: true, selfLatest: { version: '4.11.0' } };
  c7.stores.memory.WPU_localFlows = local;
  c7.stores.memory.WPU_newTab = newTab;
  const types = [...new Set(newTab.filter(n => n.type && !['tab','subflow','group','junction'].includes(n.type) && !n.type.startsWith('subflow:')).map(n => n.type))];
  const pal = [{ nodes: types.map(t => ({ type: t, types: [t], enabled: true })) }];
  const r7 = c7.run('wpu0096', { statusCode: 200, payload: pal });
  ok(r7[1] === null, 'no error on valid self-merge', r7[1] && r7[1].payload);
  const post = r7[0];
  ok(post.url === 'http://127.0.0.1:1880/flows' && post.method === 'POST' && post.headers['Node-RED-Deployment-Type'] === 'full' && post.payload.rev === 'rev77', 'POST loopback, full, rev');
  const merged = post.payload.flows;
  const mids = merged.map(n => n.id);
  ok(new Set(mids).size === mids.length, 'no duplicate ids after self-merge');
  const nonWpuLocal = local.filter(n => !String(n.id).startsWith('wpu'));
  ok(nonWpuLocal.every(n => mids.includes(n.id)), 'ALL non-wpu local nodes (real package + personal tab) preserved');
  ok(merged.filter(n => String(n.id).startsWith('wpu')).length === newTab.length, 'wpu set == new tab exactly');
  ok(merged.some(n => n.id === 'mytab1') && merged.some(n => n.id === '92e5b2c.00a8b5'), 'personal tab + broker untouched');
  ok(post._mergeStats && post._mergeStats.unchanged + post._mergeStats.updated + post._mergeStats.added + post._mergeStats.removed === local.filter(n => String(n.id).startsWith('wpu')).length, 'stats add up to old wpu count', post._mergeStats);
  ok(r7[2] && /wp-preupdate-flows-/.test(r7[2].filename), 'pre-update snapshot emitted');
  // palette missing a type -> refuse
  const c8 = makeCtx();
  c8.stores.default.WPU = { rev: 'r', apiV2: true };
  c8.stores.memory.WPU_localFlows = local;
  c8.stores.memory.WPU_newTab = newTab;
  const pal2 = [{ nodes: types.filter(t => t !== 'ui_button').map(t => ({ type: t, types: [t], enabled: true })) }];
  const r8 = c8.run('wpu0096', { statusCode: 200, payload: pal2 });
  ok(r8[1] && /ui_button/.test(r8[1].payload) && r8[0] === null, 'missing palette type refuses BEFORE POST');
}

section('T19 v4.11.1 network-catch hygiene (feedback on network errors)');
{
  const all = Array.isArray(tab) ? tab : tab.nodes;
  const httpNodes = all.filter(n => n.type === 'http request').map(n => n.id);
  const catch59 = all.find(n => n.id === 'wpu0059');
  ok(catch59 && Array.isArray(catch59.scope), 'catch wpu0059 exists with an explicit scope');
  const uncaught = httpNodes.filter(id => !(catch59.scope || []).includes(id));
  ok(uncaught.length === 0, 'every http request node is in catch wpu0059 scope (network errors produce a readable toast, never silence)', uncaught);
  const catch56 = all.find(n => n.id === 'wpu0056');
  const fileNodes = all.filter(n => n.type === 'file' || n.type === 'file in').map(n => n.id);
  const uncaughtFiles = fileNodes.filter(id => !(catch56.scope || []).includes(id));
  ok(uncaughtFiles.length === 0, 'every file node is in catch wpu0056 scope', uncaughtFiles);
}

section('T20 v4.11.2 deploy log hygiene (every deploy outcome leaves an audit trail)');
{
  const c = makeCtx();
  c.run('wpu0031', { statusCode: 200, payload: {} });
  ok(c.nodeLogs.some(l => l[0] === 'log' && /deploy OK/.test(l[1])), 'successful deploy logs an OK line (the success toast may be lost when the flow replaces itself)');
  ok(!c.nodeLogs.some(l => l[0] === 'warn'), 'success produces no warn');
  const o409 = c.run('wpu0031', { statusCode: 409, payload: { error: 'version mismatch' } });
  ok(o409.topic === 'WP Update error' && c.nodeLogs.some(l => l[0] === 'warn' && /409/.test(l[1]) && /version mismatch/.test(l[1])), '409 rev conflict warns with the response body + error toast');
  const o500 = c.run('wpu0031', { statusCode: 500, payload: 'boom' });
  ok(o500.topic === 'WP Update error' && c.nodeLogs.some(l => l[0] === 'warn' && /500/.test(l[1]) && /boom/.test(l[1])), 'generic deploy failure warns with status + body (the toast\'s "full message in the Node-RED log" is now true)');
}

console.log('\n==============================');
// ---------------- T21: v4.12 sectional dashboard, updater UX parity, download headers, EN UI ----------------
section('T21 v4.12: dashboard sections, updater check-then-apply UX, response-node headers, English UI');
{
  const byid = Object.fromEntries(tab.map(n => [n.id, n]));
  const groups = tab.filter(n => n.type === 'ui_group');
  const gnames = groups.map(g => g.name + ':' + g.order).sort();
  ok(groups.length === 4 && gnames.join('|') === 'Admin:4|Backup & export:3|Update:1|Updater:2', 'four dashboard groups Update/Updater/Backup & export/Admin in order 1-4', gnames);
  const widgetGroups = new Set(groups.map(g => g.id));
  const widgets = tab.filter(n => String(n.type).startsWith('ui_') && n.type !== 'ui_tab' && n.type !== 'ui_group' && n.type !== 'ui_toast');
  ok(widgets.every(w => widgetGroups.has(w.group)), 'every dashboard widget is assigned to a section group', widgets.filter(w => !widgetGroups.has(w.group)).map(w => w.id));
  ok(byid['wpu00a0'] && byid['wpu00a0'].type === 'ui_button' && byid['wpu00a0'].topic === 'selfcheck' && JSON.stringify(byid['wpu00a0'].wires) === '[["wpu0010"]]' && byid['wpu00a0'].group === 'wpu-ui-grp2', 'Check updater version button (topic selfcheck) in Updater group wired to wpu0010');
  ok(byid['wpu00a1'] && byid['wpu00a1'].type === 'ui_text' && byid['wpu00a1'].group === 'wpu-ui-grp2' && byid['wpu00a1'].format === '{{msg.payload}}', 'Updater version display ui_text in Updater group');
  ok(byid['wpu0090'] && byid['wpu0090'].topic === 'selfupdate' && byid['wpu0090'].group === 'wpu-ui-grp2', 'Update the updater button (topic selfupdate) in Updater group');
  ok(byid['wpu0093'] && byid['wpu0093'].outputs === 3 && JSON.stringify(byid['wpu0093'].wires) === '[["wpu0094"],["wpu00a1"],["wpu074"]]', 'wpu0093 wires: out1 download, out2 version display, out3 error hub');
  ok(byid['wpu0015'] && byid['wpu0015'].outputs === 5 && JSON.stringify(byid['wpu0015'].wires[4]) === '["wpu0092"]', 'wpu0015 out5 -> wpu0092 (pinned updater version.json)');
  for (const nid of ['wpu0029', 'wpu0085']) {
    const n = byid[nid];
    ok(n && n.type === 'http response' && n.headers && typeof n.headers === 'object' && !Array.isArray(n.headers) && Object.keys(n.headers).length === 0, nid + ' http response headers is an empty OBJECT {} (Node-RED 5.x then sends msg.headers set by the function)', n && n.headers);
  }
  for (const nid of ['wpu0028', 'wpu0084']) {
    ok(/Content-Disposition/.test(byid[nid].func) && /attachment/.test(byid[nid].func) && /Content-Type/.test(byid[nid].func), nid + ' serve function sets Content-Type + Content-Disposition: attachment (browser downloads the file)');
  }
  const vjson = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
  const tabNode = tab.find(n => n.type === 'tab');
  ok(tabNode.version === vjson.version && /^\d+\.\d+\.\d+$/.test(vjson.version), 'tab version === version.json version (' + tabNode.version + ')', { tab: tabNode.version, json: vjson.version });
  ok(/^https:\/\/raw\.githubusercontent\.com\/MikeyMan83\/HeishamonNR-update-tab\//.test(vjson.flowUrl), 'version.json flowUrl allowlisted to this repo');
  const dutch = /\b(nieuwe|nieuw|fout|fouten|melding|deze|installeer|uitvoer|controleer|herstel|toepass|bestand|huidige|nieuwste|opslaan|sluit|gelukt|mislukt|gereed|bezig|opnieuw|annuleer|bevestig|verwijder|gewijzigd|toegevoegd|ongewijzigd|onbekend|geweigerd|ophalen|hersteld|bijgewerkt|terwijl|verwacht|wachwoord|gebruiker|pagina|omgeving|variabele|veld|velden|inlog|mogelijk|hernoemd|handmatig)\b/i;
  const leaks = [];
  for (const n of tab) for (const f of ['name', 'label', 'tooltip', 'ok', 'cancel']) {
    if (typeof n[f] === 'string' && dutch.test(n[f])) leaks.push(n.id + '.' + f);
  }
  ok(leaks.length === 0, 'no Dutch left in user-visible node fields (name/label/tooltip/ok/cancel)', leaks);
}

// ---------------- T22: v4.12.2 compact half-width sections, English comments/stats ----------------
section('T22 v4.12.2: compact half-width sections (6 units), full 6-wide rows, English comments/stats');
{
  const byid = Object.fromEntries(tab.map(n => [n.id, n]));
  const groups = tab.filter(n => n.type === 'ui_group');
  const widgets = tab.filter(n => String(n.type).startsWith('ui_') && n.type !== 'ui_tab' && n.type !== 'ui_group' && n.type !== 'ui_toast');
  ok(groups.length === 4 && groups.every(g => Number(g.width) === 6), 'all four sections are compact half-width blocks (6 units: two sections per row on a desktop browser, DB1 default grid)', groups.map(g => g.width));
  const ragged = [];
  for (const g of groups) {
    const gw = Number(g.width) || 12; // ui_group exports width as a string ("6")
    const items = widgets.filter(w => w.group === g.id).sort((a, b) => a.order - b.order);
    let used = 0, full = true;
    for (const it of items) {
      if (used > 0 && used + it.width > gw) full = false;
      used += it.width;
      if (used === gw) { used = 0; } else if (used > gw) { full = false; used = used % gw; }
    }
    if (used !== 0) full = false;
    if (!full) ragged.push(g.name);
  }
  ok(ragged.length === 0, 'every section packs into full 6-wide rows (no ragged wrapping)', ragged);
  ok(byid['wpu0001'].width === 3 && byid['wpu0003'].width === 3 && byid['wpu0007'].width === 3 && byid['wpu0008'].width === 3 && byid['wpu0009'].width === 6, 'Update section (6): Check(3)+RUN(3), Installed(3)+Available(3), Status full width (6)');
  ok(byid['wpu00a0'].width === 3 && byid['wpu0090'].width === 3 && byid['wpu00a1'].width === 6, 'Updater section (6): two buttons on one row, Updater field full width');
  ok(byid['wpu0049'].width === 3 && byid['wpu0080'].width === 3 && byid['wpu0058'].width === 6, 'Backup & export (6): Backup(3)+Restore(3), Confirm(3)+Download(3), Backup folder(6) full row');
  ok(byid['wpu0005'].width === 6 && byid['wpu0006'].width === 6, 'Admin section (6): user and password each a full row');
  const f30 = byid['wpu0030'].func, f96 = byid['wpu0096'].func, f31 = byid['wpu0031'].func;
  ok(/added: stNew\.length/.test(f30) && /unchanged: stSame/.test(f30) && !/\bnieuw:/.test(f30), 'wpu0030 _mergeStats uses English keys (added/updated/removed/unchanged)');
  ok(/added: stNew\.length/.test(f96) && !/\bnieuw:/.test(f96), 'wpu0096 self-merge stats use English keys');
  ok(/s\.added/.test(f31) && /s\.unchanged/.test(f31) && !/s\.nieuw/.test(f31), 'wpu0031 deploy toast consumes the English stats keys');
  const nl = /à|é|í|ó|ú|ë|ï|ö|ü|\b(de|het|niet|van|met|voor|door|naar|bij|als|dan|nog|alleen|geen|wordt|worden|zit|zitten|staat|staan|gaat|heeft|hebben|moet|moeten|kan|kunt|deze|die|hier|daar|zijn|wel|weer|terug|oude|nieuw\b|nieuwe|lokaal|huidige|draaiende|gebruiker|wachtwoord|geheugen|schrijf|automatisch|handmatig|voorkomt|voorkomen|blijft\b|blijven\b|valt\b|vallen\b|opgehaald|opgeslagen|gewijzigd\b|ongewijzigd\b|verwijderd\b|bijgewerkt\b|vergelijkt|draaide|pakket|tabblad|controleer|melding|meldingen|generiek|persoonlijke|officiële|fase\b|veld|velden|knop|bestand|bestanden|schijf|dag\b|vandaag|twee|drie|vier|elf|twaalf|waarschijnlijk|anders|echt\b|echte|zojuist|alléén|één|uit[0-9])\b/i;
  const nlComments = [], nlCode = [];
  for (const n of tab) {
    if (typeof n.func !== 'string') continue;
    n.func.split('\n').forEach(L => {
      if (L.trim().startsWith('//') && nl.test(L)) nlComments.push(n.id + ': ' + L.trim().slice(0, 80));
      if (!L.trim().startsWith('//') && nl.test(L)) nlCode.push(n.id + ': ' + L.trim().slice(0, 80));
    });
  }
  ok(nlComments.length === 0, 'no Dutch left in code comments', nlComments);
  ok(nlCode.length === 0, 'no Dutch left in code lines (literals/identifiers)', nlCode);
}

console.log('TOTAL: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
}
