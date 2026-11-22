# Changelog

All dates are 21 Nov 2026: this tab was built, reviewed and hardened in one day. Key facts per version: the button behaviour and merge rules are stable since v4.6; earlier versions are mostly of historical interest.

## v4.11.0 (current, 83 nodes)

**Self-update of the updater itself** ("Update the updater" button, `wpu0090`, topic `selfupdate`):

- Version check against a new pinned `version.json` in this repo (`raw.githubusercontent.com/MikeyMan83/HeishamonNR-update-tab/main/version.json`), compared with the new `version` field on the `wpu-tab-0001` tab node (X.Y.Z only; unknown local version = allowed, the button press is explicit).
- Download of `update-tab.json` with the flowUrl **allowlisted to this repo**; validation before merge: JSON array, every id `wpu`-prefixed (the merge can only touch its own tab), unique ids, must contain `wpu-tab-0001`, and the tab version must match version.json (wrong file / forgotten bump = refused, nothing changed).
- Palette pre-flight via a second `GET /nodes` (`wpu0097`), then the wpu-only merge (`wpu0096`): drop all local `wpu*` nodes, append the validated new tab; duplicate-id sanity check; merge statistics (new/updated/removed/unchanged) to the Node-RED log and the deploy toast via `_mergeStats`; pre-update snapshot (`wp-preupdate-flows-*`) before the atomic `POST /flows` with rev + `Deployment-Type: full` (reuses `wpu0023`/`wpu0031`/`wpu0057`).
- Logging: `[WP Update] self-update available: old -> new`, validated node count, NEW/UPDATED/REMOVED node lists, and the POST line with rev.
- Safety: loopback/`WPU_ADMIN_BASE` admin base as always; the wpu-only scope means the self-update can never touch the HeishaMoNR package, personal tabs or broker configs; rollback = older `update-tab.json` from this repo git history + the pre-update snapshot. Trust note: the pinned repo ships executable flow code, so protect the repo/branch.
- `version.json` added to this repo (bump per release).

Validation: harness 142/142 green (`node test/harness.js`, +20 self-update asserts: phase routing, pinned URL, allowlist refusal, X.Y.Z refusal, already-latest info, wpu-only validation rules, version-mismatch refusal, wpu-only merge preserving the whole real 26.5.1 package + personal tab + broker, stats consistency, snapshot, palette refusal); live loopback deploy of v4.11 on Node-RED 5.0.10: 83 wpu nodes, tab `version` field survives the `GET /flows` round-trip, `/wpupdate/*` endpoints unaffected.

## v4.10.4 (76 nodes)

UI language unified to **English**, consistent with the edterbak package (its dashboard is English: "Home", "Inlet actual", "SET/RESET", "Version X.Y.Z Stable"): all dashboard labels, tooltips, editor node names, toast/status messages, endpoint error JSONs and Node-RED log lines translated (75 node fields + 88 string literals). Node ids, topics-as-keys and code comments unchanged. Harness assertions updated to the English strings: **122/122** green.

## v4.10.3 (76 nodes)

Layout fix: the private toast `wpu0076` (added in v4.10) was placed on the same grid cell as the error function `wpu0040` (4540,160) — moved to (4540,80). No other same-cell collisions; all 76 nodes on the 320x80 grid, link pairs symmetric, no dangling wires. Harness still 122/122.

## v4.10.2 (76 nodes)

Post-v4.10 sweep (source-verified, no live bug): the v4.10 flow-download link was wired asymmetrically and `wpu0082` (link out) was missing its `wires: []`. Verified against the Node-RED 5.0.1 sources:

- **Runtime was never broken**: `@node-red/runtime` 5.0.1 `lib/flows/util.js` `parseConfig` builds link wiring as the union of both sides' `links` arrays and then computes `n.wires = [targets]` on each link out, so the out-side `links: ["wpu076"]` alone already delivered the flow-download toast.
- **The editor self-heals the asymmetry on import** (nodes/core/common/60-link.html, `onAdd` on both link types pushes missing ids into the opposite node's `links`), but a symmetric export is what Node-RED itself always writes, and it keeps editor diffs clean after a re-import and re-deploy.
- Fix: `wpu076.links` now includes `wpu0082` (next to `wpu065`) and `wpu0082` carries `wires: []` like every other link out.
- Harness: new structural section (T17) asserts every link out/in pair is editor-symmetric and every link out has `wires: []` -> **122/122**.

## v4.10.1 (76 nodes)

Live-use finding (the backup link "didn't download anything" when clicked): node-red-dashboard's toast handler HTML-escapes every non-raw message (main.js show-toast: `temp.textContent = msg.message; msg.message = temp.innerHTML`), so the download URL in the toast was plain text, not a hyperlink. Fix, verified against the DB1 source:

- Both private toasts (`wpu0076` for the backup token, reused by the v4.10 flow download) now render raw HTML (`raw: true`) and the payloads carry a real `<a href="/wpupdate/...?token=...">Download ...</a>` anchor. The page stays put because the endpoints answer with `Content-Disposition: attachment`, so clicking starts the browser download directly.
- Toast content remains fully server-generated (timestamped filename + alphanumeric token), so enabling raw carries no injection risk; the socketid privacy fix from v4.8.1 is unchanged.
- Harness: +4 asserts (anchor present in both toast payloads, both label texts, toast node `raw: true`, flows-download anchor) -> **121/121**.

## v4.10 (76 nodes)

New feature: **Download flow** button (`wpu0080`). It runs a fresh `GET /flows` via the Admin API (phase `flowdl` through `wpu0010`, loopback/`WPU_ADMIN_BASE` as always), `wpu0015` gained a 4th output for this phase, and `wpu0081` stores the dump (`WPU_flowDump`, memory store only) plus a fresh `fl…` token (`WPU_flowDlToken`, memory, 24h) and emits a **private** toast (`wpu0082` -> `wpu076`/`wpu0076`, `sendall:false` + `msg.socketid` + `_client`, per the v4.8.1 DB1 finding) with a relative link `/wpupdate/flows?token=…`. New endpoint `wpu0083`/`wpu0084`/`wpu0085`: 404 before the first click, 403 without/wrong/expired token, 200 + `attachment; filename=flows-<date>.json` with a valid token — same protection model as `/wpupdate/backup`, since `http in` nodes sit outside adminAuth.

Credential note (live-verified on Node-RED 5.0.10): `GET /flows` strips credential-store secrets (a config node posted with `credentials: {user, pass}` comes back without them), but legacy plaintext node properties are included — hence the token gate. Documented in the README.

Validation: harness extended to **117/117** green (`node test/harness.js`: 99 v4.9 checks + 18 new — flowdl routing, dump/token memory-only, socketid passthrough, endpoint 404/403/403-expired/200, token value absent from the served payload); live loopback deploy of the merged tab (76 wpu nodes via `POST /flows`, endpoint 404 probes, `/wpupdate/backup` unaffected). Merged on top of v4.9 (merge-statistics reporting untouched).

## v4.9 (70 nodes)

Feedback improvement from live use (first real 26.3.1 -> 26.5.1 update on the target Synology): "Update geslaagd (gepland: N nodes)" did not say WHICH nodes actually changed. Now it does:

- **Merge statistics (wpu0030)**: the merge compares the running flows with the new package per id and classifies every package node as nieuw (not running yet), bijgewerkt (same id, different content; position-only x/y differences don't count), or ongewijzigd, plus verwijderd (local nodes in a package tab or a package singleton-config that fall away). The counts travel with the POST message.
- **Toast (wpu0031)**: "Update geslaagd: X nieuwe node(s) (names, max 5), Y bijgewerkt, Z verwijderd, U ongewijzigd." with a pointer to the full lists; the old text remains as fallback if the stats are ever absent.
- **Full lists in the Node-RED log (wpu0030)**: three `node.log` lines with the names + ids of all new, updated and removed nodes (up to 20 each, then "en N meer") — the update now leaves an audit trail in the container log even when the final toast never arrives (the flow replaces itself).
- Tab info mentions the reporting; node count stays 70 (function bodies only, no new nodes or wiring).
- Harness: +8 asserts (stats on the POST message in the id-stable merge, stats plausibility against the 3562-node package, stats-assert on the success toast, plus the old checks remain) -> **99/99**.

## v4.8.1 (70 nodes)

Post-v4.8 source review: every v4.8 security claim was verified against the actual library sources, not just the harness. Three findings, all fixed:

- **Private toast was still a broadcast** (the v4.8 claim was wrong): node-red-dashboard's `ui_toast` with `sendall: false` only becomes private when `msg.socketid` is set; without it `emitSocket` falls back to `io.emit`, a broadcast to every connected dashboard client (verified in the dashboard source, ui.js + ui_toast.js: button messages get `socketid` copied onto `toSend`, which is the field the toast actually checks). v4.8 built a new message with `_client` (a field nothing in DB1 reads for this purpose) and dropped `msg.socketid`, so the download token still reached all clients. Fix: `wpu0026` now forwards `socketid: msg.socketid` next to `_client` (keeps the harness check green); toast text no longer claims "only for you" without it. Comment in the code documents the DB1 semantics.
- **"Credentials never persisted" is conditional, now documented**: the tab stores its secrets via `flow.set(key, value, "memory")`, but on Node-RED 5.x an unknown store name silently falls back to the default context store (verified in the @node-red/runtime 5.0.1 source, context/index.js getContextStorage). Without a `contextStorage` block memory is the default, so the claim holds; with a custom default (e.g. file-based) and no explicit `memory` store, the password/token still hit disk. Fix: README edge case + settings.js snippet (define an explicit `memory: { module: "memory" }` store).
- **`RED.settings` does not exist in a function node**: the function sandbox (@node-red/nodes 5.0.1, core/function/10-function.js) exposes only `RED.util`, and `getSetting` is a stub, so the guarded `RED.settings.httpAdminRoot` always yields an empty string and the v4.8 adminBase is always `http://127.0.0.1:1880` regardless of a configured `httpAdminRoot`. README corrected: `WPU_ADMIN_BASE` is required for a non-standard port or a non-empty `httpAdminRoot`.
- Stale texts: the error hints in `wpu0015`/`wpu0030`/`wpu005a` and the tab info still referred to the removed "Admin API URL" field; now they point to `WPU_ADMIN_BASE`.
- Harness re-run after the fixes: **91/91** simulation checks green.

## v4.8 (70 nodes)

Fourth external review processed; every finding verified against the v4.7 code before fixing. Fixes:

- **Admin API URL no longer dashboard-controlled** (credential exfiltration, high): the "Admin API URL" input (`wpu0004`) was removed. All Admin API calls now use a server-side derived base (`adminBase()` helper in `wpu0010`/`wpu0021`/`wpu0030`): `http://127.0.0.1:1880` + `httpAdminRoot` (read via `RED.settings`, guarded), or the `WPU_ADMIN_BASE` environment variable for non-standard ports. Previously, anyone with dashboard access could set the base URL to their own server and harvest the `WPU_ADMIN_USER`/`WPU_ADMIN_PASS` env credentials via the `POST /auth/token` body. (v4.8.1 correction: the `RED.settings` read is a no-op in the function sandbox, so in practice the base is always `http://127.0.0.1:1880` unless `WPU_ADMIN_BASE` is set.)
- **Backup download token no longer broadcast** (high): the backup-complete message now routes via a dedicated link pair (`wpu065` -> `wpu076` link in -> `wpu0076`, a `ui_toast` with `sendall: false` and the clicker's `_client` preserved) instead of the shared notification hub, so the token is never sent to all dashboard clients and never lands in the shared Status field. The download link is now a relative path (`httpNodeRoot + /wpupdate/backup?token=...`) resolved against the dashboard's own origin, instead of a host derived from the old URL field. The in-memory `WPU_BACKUP` dump moved to the memory context store as well. (v4.8.1 correction: this was not yet true, DB1 needs `msg.socketid` for a private toast; that is exactly what v4.8.1 fixes.)
- **Credentials never persisted**: UI password (`WPU_pass`), admin bearer token (`WPU_token`/`WPU_tokenTime`) and download token (`WPU_dlToken`/`WPU_dlTokenTime`) now live only in the memory store — with file-based context storage nothing credential-like hits disk anymore. Consequence: after a Node-RED restart the UI password must be re-entered (env vars remain the persistent route, documented in the README and the password-field tooltip). (v4.8.1 caveat: only true if settings.js has no custom default context store; Node-RED falls back to the default store for an unknown store name, documented in the README.)
- **Robust version detection**: fallback scan for any node with "changelog" in its name (`format`/`info`/`label`), so renaming the changelog node no longer breaks detection; and an unknown current version is reported honestly instead of being treated as older — previously every check would show a phantom "update!" and UPDATE would redeploy the same version.
- **Subflow match in the rebuild safety net**: subflows are matched on their `name` (they have no `label`), so a full id-rebuild would now also clean up rebuilt subflow definitions instead of leaving unreferenced duplicates.
- Node count 69 -> 70 (removed `wpu0004`, added `wpu076`/`wpu0076`).

Validation after the change (reproducible via `node test/harness.js`, committed):

- Structure: JSON re-parsed, 70 nodes, no dangling wires/links, all 19 function bodies pass `node --check`, no references to the removed `adminBase`/persistent-token fields remain.
- **91/91 simulation checks** running the literal shipped `func` code in a mocked Node-RED function environment against the **real `flows (26.5.1 stable).json` from edterbak/HeishaMoNR** (downloaded automatically on first run): version detection reads 26.5.1 from the real changelog node; id-stable merge delivers all 3562 package nodes with zero duplicate ids, local broker (reconfigured host) wins, personal tab + the updater tab itself survive, `global-config` env merge works, pre-update snapshot emitted; full id-rebuild scenario cleans all 12 old WP/GUI tabs by label, rewrites placeholder-broker refs to the live broker, reports orphan ui_tabs; palette pre-flight refusal; 409 handling; SSRF guard (evil `adminBase` in context is ignored, all Admin API calls go to loopback/`WPU_ADMIN_BASE`, env credentials are only POSTed to loopback); token/password/download-token memory-only; backup excludes `WPU_*`; download endpoint 403/404/200 + 24h expiry; private toast keeps `_client` and uses a relative link; boot never echoes the password; restore refuses without snapshot confirmation.
- **12/12 live Admin API contract checks** against a real local Node-RED (loopback `127.0.0.1:1880`, no adminAuth, node-red-dashboard installed): `GET /flows` v1 array vs v2 `{flows, rev}`; `GET /nodes` returns JSON only with `Accept: application/json` (HTML blob without — exactly why the tab sets it); `POST /flows` with v2 + `Node-RED-Deployment-Type: full` + rev deploys the actual `update-tab.json` (200, all 70 wpu nodes present); stale rev -> 409; v1 bare-array POST still accepted; `/wpupdate/backup` answers 404/403 as designed.
- The v4.7 S-suite (127/127) should still be re-run on the target Synology; the changed code paths are S1, S2, S6, S11 and S13.

## v4.7 (69 nodes, 127/127 checks)

Third external review (Gemini) processed, every claim verified first. Most reported bugs turned out to refer to the v4.4 code and were already fixed in v4.5/v4.6; the catch-scope claim was partly valid: the backup write actions were indeed missing. Five real fixes:

- **Readable network errors**: all seven http request nodes now feed a dedicated catch chain (`wpu0059` catch -> `wpu005a` "network error readable" -> `wpu005b` link out to the error hub). DNS and connection errors carry no statusCode and previously disappeared silently; the Node-RED runtime puts `msg.error = { message, source, code }` on the catch message (verified against the 5.x runtime source, Flow.js handleError + 21-httprequest.js), which the chain surfaces as "Network error: ...". Nuance from the same source: without the `senderr` option, http request also passes the error down the normal wire (statusCode = err.code), so a second, generic error message can follow alongside; both go to the toast, nothing disappears silently.
- The file catch node (`wpu0056`) now covers all five file actions, including the two backup writes that were missing.
- The download link in the backup toast is derived from the Admin API URL (scheme://host:port) instead of a hardcoded `http://<node-red>:1880`.
- Dutch texts: fixed one typo and the missing diacritics (Geinstalleerd -> Geïnstalleerd, geinspecteerd -> geïnspecteerd) in node names, labels, tooltips and code.
- Own find on top of the review: the suspect-tab warning flagged the "WP Update" tab itself on every merge (it always matched the /^WP / rule and never appears in the package tab list); "WP Personal" and "WP Update" are now both exempted (rule `/^WP (Personal|Update)$/`).
- Gemini's HTML-scan truncation claim was live-tested and is not a real problem today (repo root: 9 files, the 234 KB HTML payload contains all flow-json names, the scan finds 26.5.1); documented as an edge case in the README. The self-update question (Ed shipping the tab inside the package) is covered in the README edge cases.

Suite fully rebuilt: 127/127 (S0-S15, including real 26.3.1/26.5.1 merges with the updater tab itself in localFlows; network-error scenarios, catch scopes, host derivation, diacritics-correct texts, all file actions enqueued).

## v4.6 (66 nodes, 101/101 checks)

Second external review (ChatGPT) processed, verified first. The reported "critical" (unauthenticated download endpoint) had already been addressed in v4.5 by the one-time download token; the described c.token bug was v4.4 code, already fixed in v4.5. Real new improvements:

- Download token TTL of 24 hours plus an expiry message.
- Proactive admin-token refresh after 1 hour (the token was previously only refreshed reactively on a 401).
- **Download integrity**: the changelog node ("Line - Changelog") inside the downloaded file must report the expected version; a mismatch refuses the update before palette check and merge (wrong file or forgotten bump = refused, nothing changed).
- Only X.Y.Z versions accepted from version.json (prerelease strings previously compared as NaN and produced a false "newer").
- The restore now requires a positive write confirmation of the pre-restore snapshot (the file node only outputs after a successful write; v4.6 additionally checks that confirmation explicitly). Without it, nothing is restored.
- The doomedLocalTabs label safety net now works per label: on an id-stable release the package tab already matches by id and an extra, personal tab with the coincidentally same label stays; on a genuine id-rebuild (no id match on that label at all) the net still cleans up everything.

Deliberately documented instead of changed: the backup scope (default global context store only) and the meaning of "atomic" (the deploy operation; the pre-update snapshots are the recovery mechanism).

## v4.5 (66 nodes, 119/119 checks)

First external review processed, both blockers verified against the real editor-api source (4.0.9 and 5.0.10, `lib/admin/nodes.js`) before fixing:

- **Blocker 1**: `GET /nodes` only returns JSON with `Accept: application/json`; without that header an HTML config blob comes back and the palette check would have reported every type as missing. Fixed.
- **Blocker 2**: tab/subflow/group/junction and subflow instances are flow-config types, not palette types; the palette check wrongly demanded them, so any package with a tab failed by definition. Fixed: only sets without err and with enabled=true count.
- One review claim turned out to be wrong (the /nodes response is a flat list of node sets, not nested modules); the new parser supports both shapes defensively.
- Further fixes: the password was echoed as a predefined value to every dashboard client on boot (removed; the field stays empty, password only in context); `WPU_BACKUP` nested itself into every subsequent backup (now skipped in backup, pre-restore snapshot and restore); optional Backup directory field (/data in Docker, because the container working dir is not persistent); 401 handling plus token invalidation on changed credentials (the token was cleared in the wrong context); env merge of the local global-config; a pre-update flow snapshot before every deploy; a freshness check on the last Check (older than 1 hour refuses); flowUrl pinned to `https://raw.githubusercontent.com/edterbak/HeishaMoNR/...`; one-time download token on `/wpupdate/backup` (http in nodes sit outside adminAuth).
- Deliberately not adopted: a second confirmation click on Update now (the atomic operation, rev check, freshness check and snapshot cover the same risk without an extra click).

## v4.4.2 (64 nodes, 87/87 checks)

Complete code re-verification round ("check with vibe code"): the whole suite was rebuilt and run at once against the real 26.3.1/26.5.1 packages plus a live GitHub repo scan. The layout check switched to an honest Node-RED polyline model (horizontal, midgap vertical, horizontal, real 30px node boxes) instead of straight lines; it found 3 avoidable wire crossings, all fixed (the scan error link as a flat stub at scan-lane height, the toast as a hook directly under the error hub, the status lane kept free). Remaining: 0 node overlaps, 0 grazes, exactly 1 topologically unavoidable crossing at the two version fields (a fan-in shared by the check and scan arms). Scaffold rule generalized (same column, down on the 80px grid, no node in between).

## v4.4.1 (64 nodes)

Live 404 fixed on Update now, diagnosed in two steps: the container can reach raw.githubusercontent.com directly (HTTP 200, 2,956,342 bytes), so it was not a network issue; the cause was **double percent-encoding inside the flow**: the repo scan stores the raw URL already percent-encoded and the apply route applied encodeURI() again, turning %20 into %2520, a URL to a non-existing file (live verified: the double-encoded URL returns exactly "404: Not Found"). The reason Check for update did work: the check route never fetches that URL. Fix: flowUrl is normalized on storage (spaces -> %20, existing %XX intact, loose % escaped) and used unencoded on download; the download error message now includes the status code AND the exact URL used. Verified with S19 (11/11).

## v4.4 (64 nodes, 115/115 checks)

- All spaghetti wires to the error and notification hubs replaced by link nodes (14x link out to the error hub wpu074 and the notifications hub wpu075, 2x link in), exactly how the package itself does it (756 link nodes in 26.5.1).
- Uniform grid: columns at x = 60 + 320*k, lanes at multiples of 80, with fixed reading rules (check main lane, token arm, scan arm, update chain, backup and restore lanes, report corner top-right). Every wire runs left to right; the link outs sit as hook-backs directly under their source node. Result: 0 overlap, 0 grazes, 0 crossings (59 wires).

## v4.3 (48 nodes, 109/109 checks)

Second live smoke test ("errors gone, still messy") led to a topological layout: longest-path layers plus barycenter vertical placement instead of manual columns; every wire strictly left to right, hubs at the center of mass of their sources, column spacing larger than column width, 20px grid. Vertical order then optimized (hill-climb + annealing) down to 4 wire grazes on 62 wires and 19 crossings.

## v4.2 (48 nodes)

First live smoke test in a real Node-RED (5.0.1); two causes of editor warnings found and fixed:

- **File nodes "not properly configured"**: a file/file in node with `filenameType: "msg"` expects the msg property NAME in `filename` (convention: `"filename"`); an empty string makes the editor node invalid and the runtime throws "Invalid property expression: empty string". Fixed on all four file nodes (verified against 10-file.html/js of both 3.1.x and 5.0.1: identical model).
- **ui_toast flagged**: HeishaMoNR runs on node-red-dashboard DB1 (16x ui_toast + ui_ui_control in the package), not on FlowFuse Dashboard-2. DB1 requires an `ok` value (default "OK") on the definition side and the toast node has 0 outputs. Fixed: `ok: "OK"`, outputs/wires removed.
- Complete re-layout (48 nodes, grid-aligned, no overlap, chains per lane).

## v4.0/v4 (64 nodes)

- **Restore chain added**: Restore reads the fixed `wp-backup-latest.json` copy (which Backup settings writes next to the timestamped archive) from disk, inspects it (keys/timestamp/version) and asks for a second click; on confirm it first writes a pre-restore snapshot of the current state and only then restores (per key, merging: extra current keys stay). The restore itself is reversible and works after a Node-RED restart because it reads from disk. A catch node handles read errors.
- **Credentials**: in addition to the UI fields (password masked, mode password) the environment variables `WPU_ADMIN_USER`/`WPU_ADMIN_PASS` (docker/settings.js); UI fields win; the password then never sits in the editor or context.
- **Orphan report only on a real rebuild**: rebuildDetected = label match without id match (on id-stable merges the doomed-local-tabs list was also filled via label, but label and id match coincide; false "Home" warning fixed).

## v3 (64 nodes)

Initial complete version of the tab (5 buttons + 18 function nodes + http/file chain + link hub wiring), with the three rebuild safety nets:

- Flow tabs are additionally recognized by LABEL (doomedLocalTabs): on a full id-rebuild, old package tabs are still cleaned up and reported.
- Broker rescue: a package referencing a placeholder broker ("x.x.x.x") that does not exist locally gets all its mqtt references rewritten to the locally most-used broker.
- Orphan ui_tabs and suspect local WP-named tabs are REPORTED in the success toast instead of silently deleted; an own ui_tab with a generic name ("Home", "Settings") is guaranteed to survive.

The merge core and version chain were proven against the real 26.3.1 and 26.5.1 packages; the Admin API contract was verified against the editor-api source. Versioned smoke tests and three external reviews (each claim verified before fixing) followed the same day; see the README for the honest edge cases and the current test report.
