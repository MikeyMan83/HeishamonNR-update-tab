## Docs: context store note (no version bump)

- README gained a "Context store note": the tab keeps the session password, tokens and the large in-flight dumps in a context store NAMED `memory` by design (volatile data never on disk). Installs using Node-RED's default template store names (`memoryOnly`/`file`) lack that store name, so Node-RED logs its "Unknown context store 'memory' ... Using default store." fallback warning on every use. The fix is a one-line settings.js alias, documented in the README. No flow change: the named-store design is intentional (a function node cannot discover the configured store names at runtime).

## v4.12.12 (current, 100 nodes)

Dashboard-family guard in the self-update merge (`wpu0096`): before merging, the dashboard framework of the local `wpu*` nodes is compared with the new tab's (DB1 `ui_tab`/`ui_*` vs DB2 `ui-page`/`ui-*`). A framework switch (e.g. the DB2 file on the `dashboard2` branch) is **refused with a clear error before any POST** - the tab would otherwise leave the current dashboard menu (`/ui` vs `/dashboard`) and its widgets would register nowhere. A framework-switching file can now only arrive by deliberate manual import. Same-family updates are unaffected.

- Harness: 2 new asserts in T18 against `wpu0096` (refuse db1->db2 before POST with the guard message; allow db1->db1) -> **234/234**.
- Tab node `version`, boot-inject payload and `version.json` bumped to 4.12.12 together, so a running 4.12.11 tab offers this via [Update tab].

## v4.12.11 (100 nodes)

Live finding 24 Nov (dashboard screenshot while 4.12.10 was waiting): when an update is available, the Tab status field appended the repo release notes to the actionable sentence, but the notes text is longer than the field, so the line arrived clipped mid-sentence on the dashboard.

- wpu0093: the Tab status field now shows the actionable sentence only ("Tab update available: x.y.z. Press [Update tab].", plus " (current version unknown)" when applicable). Release notes are no longer rendered inline; the CHANGELOG stays the readable source, and the notes string still lands in flow context (WPU.selfLatest.notes).
- version.json notes kept short, since a future display change might want to show them again.
- Harness: T24 now pins the notes-free sentence and adds an assert that WPU.selfLatest.notes still stores the notes -> **232/232**.
## v4.12.10 (100 nodes)

Wording follow-up on v4.12.9 (user feedback: "up to date might be the simpler wording"): the up-to-date confirmation on both status fields is now the short, glanceable "Up to date (x.y.z)." instead of the sentence "You are already running the latest (tab) version (x.y.z)". Status displays should confirm quickly; the actionable update messages keep their full sentences with the button to press. Applied consistently to the Tab status field (wpu0093), the Flow status check (wpu0019) and the repo-scan fallback (wpu001a), so both status fields still speak one identical template:

- **Tab status**: "Up to date (4.12.10)." (was "You are already running the latest tab version (...).").
- **Flow status**: "Up to date (26.5.1).", from both the version.json check and the repo-scan fallback.
- The update-available messages are unchanged ("Tab update available: x.y.z. Press [Update tab]."), as is the boot sentence "Running tab version 4.12.10." (version bump only).
- No runtime behavior change; the version is bumped on all three spots so running 4.12.9 tabs self-update.
- Harness: the up-to-date display asserts in T5/T13/T24/T26 moved to the new wording -> **231/231**.
## v4.12.9 (100 nodes)

Consistent dashboard vocabulary and section layout (user feedback on v4.12.8: "quite some inconsistency with the layout and the wording"). The ruleset is UI/UX best practice (one concept gets one name and one sentence style; a confirm button names its object; tooltips name their buttons) plus alignment with the conventions of Ed's own flow (Title Case noun captions, inputs above outputs, short verb-first button labels):

- **Four parallel section captions**: new Ed-style hr dividers captioned "Flow" (top of the Update column) and "Backup" (top of the Backup column), next to the existing "This tab" and "Admin", so every dashboard block now carries a Title Case caption.
- **The "Tab version" field is renamed "Tab status"** and restyled to exactly match the "Flow status" widget (6 units wide, 2 rows, left-aligned). The two status fields also speak the same sentence style now: "Tab update available: 9.9.9. Press [Update tab]." (plus " (current version unknown)" when no running marker survives an editor Deploy) and "You are already running the latest tab version (4.12.9)." replace the arrow shorthand "4.12.8 -> 4.12.8 (up to date)". The node status under the function keeps the compact arrow format.
- **Boot sentence**: the boot inject now writes "Running tab version 4.12.9." into the field (one sentence style, was "Running: 4.12.8"); the v4.12.8 editor-Deploy fallback still parses the boot payload, unchanged.
- **[Confirm restore] -> [Confirm restore backup]** (the confirm names its object, parallel to [Restore backup]); the restore prompt now says "Press [Confirm restore backup] to restore."
- **Tooltips speak the button names**: [Update flow] now advises "Make a [Back up settings] first; the flows restart afterwards.", and the [Check for updates] tooltip says "Tab status field" instead of "Tab version field". The deploy toasts likewise say "Tab status field".
- Group name "Backup & admin" -> "Backup & Admin" (Title Case, like the four captions).
- No runtime behavior change; the version is bumped on all three spots (tab node, boot sentence, version.json) so running 4.12.8 tabs self-update to the new layout.
- Harness section T27 added (+4: Flow and Backup caption dividers, Flow status and Tab status share one widget style, restore chain and tooltip wording); the wpu0093 display asserts in the older self-update sections and in T23/T24/T26 moved to the sentence format -> **231/231**.
## v4.12.8 (98 nodes)

The Tab version field survives a manual editor Deploy (live finding 24 Nov: after importing an unrelated flow in the browser editor and pressing Deploy, the Tab version field showed "unknown -> 4.12.7 (update!)" while 4.12.7 was actually running):

- **Root cause, source-verified** (@node-red/editor-client `src/js/nodes.js`): a Deploy posts `createCompleteNodeSet()`, which exports flow tabs through `convertWorkspace()`. That function copies only the registered tab fields (id, type, label, disabled, info, env), so every custom property on a tab node (including this tab's `version`) is silently deleted by each editor Deploy. Admin API deployments (this tab's own updates and every loopback POST /flows) keep the raw config, which is why the field read correctly until the first manual editor Deploy since the tab's install. The flow check is unaffected: it reads the version from the package changelog node (a regular, registered node property).
- **Fix**: wpu0093 falls back to the boot inject (wpu00c2) payload ("Running: x.y.z") when the running tab node has lost its version property. The inject payload is a registered default that survives an editor Deploy, and T23 already pins it to the tab node version and version.json. No new version location; with both markers absent the display stays the honest "unknown".
- Harness section T26 added (+5: fallback present, stripped version still displays cur, up to date through the fallback, no-markers "unknown" unchanged, boot payload in sync) -> **227/227**.

## restore-helper.json (companion, no tab version bump)

Disaster recovery from the LOCAL backup download (user feedback: the browser download is the only copy you can still reach when everything else is gone; the on-disk backups and [Restore backup] require a living tab, the local file does not):

- **restore-helper.json** is a small companion flow (6 nodes, wprh-prefixed ids, never wpu) for the worst case: Node-RED still runs but the tab does not (or you choose not to use it). Import it, deploy, POST the local download, delete the flow again. Same merge semantics as the tab's own [Restore backup] (wpu0055): every backup key overwrites the current value, keys that exist now but not in the backup stay, WPU_ state is never restored. Parse accepts object, string and Buffer bodies; invalid input answers 400 and restores nothing.
- Endpoint: POST /wpupdate/restore-helper, e.g. `curl -X POST -H "Content-Type: application/json" --data-binary "@wp-backup-....json" http://<node-red-host>:1880/wpupdate/restore-helper`. Node-RED accepts http-in bodies up to apiMaxLength (default 5 MB, verified in the 5.0.10 21-httpin.js source); settings backups fit. The endpoint is deliberately token-free but unauthenticated (http nodes sit outside adminAuth), hence the delete-after-use warning.
- No tab version bump: update-tab.json is untouched (still v4.12.7, 98 nodes), the running tab keeps reporting "up to date". README gained a "Manual restore of a local backup (worst case)" section with the full procedure. Harness: new T25 (+11 checks: structure, wprh id rules, mocked restore incl. string/Buffer/400) -> **222/222**.

## v4.12.7 (98 nodes)

Download discoverability (user feedback: click Back up settings / Download flows and "the browser does nothing"; the only download path was a private toast that disappeared after 10 seconds):

- **The download toast stays open 60 seconds** (was: 10). Verified against the node-red-dashboard 3.6.3 source (ui_toast.js): "var dt = node.displayTime || msg.timeout * 1000 || 3000; if (dt <= 0) { dt = 1; }". DB1 has no sticky toast (displayTime 0 falls back to the 3 s default, negative clamps to 1 ms), but an EMPTY node displayTime lets the per-message msg.timeout win. Both producers (wpu0026 backup, wpu0081 flows) now send timeout: 60 and the wpu0076 node displayTime is empty.
- **Clearer toast text**: a bold Download-the-backup / Download-the-flows link on its own line with "click here, this toast stays open 60 seconds", so the intended action is unmissable. The disk copy (wp-backup-latest.json) is still mentioned: that is the file [Restore backup] reads after a Node-RED restart; the browser download is the copy for off-device archiving.
- Harness: +3 asserts (msg.timeout 60 on both producers, empty node displayTime with the DB1 clamp rationale) and the T24 tab-side asserts made version-agnostic (they hardcoded the running version) -> **211/211**. Node count unchanged (98); no wiring change, only the two function payloads and the one toast-node field.

## v4.12.6 (98 nodes)

One check instead of two (user request: "Do we need two check version buttons?" with the follow-up to merge them cleanly):

- **Single [Check for updates] button**: [Check flow version] and [Check tab version] are merged. One click still costs one Admin API call (token + GET /flows); the check branch of wpu0015 now emits both pinned, cache-busted fetches in parallel (the package version.json for Installed vs Available, and this repo's version.json for the Tab version field). [Update flow] stays a pure flow action: the apply phase never triggers the tab check.
- **[Check tab version] removed**: [Update tab] is itself check-then-apply (fetch pinned version.json, show `current -> available (update!)/(up to date)`, download only when newer), so a separate look-only check button added no safety while it did add a second button and vocabulary.
- **Wording swept**: wpu0015/wpu0030/wpu0031 error texts now say "Press [Check for updates] first"; wpu0090's tooltip rewritten without the [Check tab version] reference; the stale "Update now" README bullet renamed to the button's real name [Update flow] (a leftover from before the v4.12.4 rename).
- Harness: T21/T22/T23 moved to the merged vocabulary (98 nodes, 8+8 widgets, four cache-busters in wpu0015, the stale-name regex now also rejects "Check flow version" and "Check tab version"), new **T24** (merged check emits both fetches, apply stays pure, selfcheck never downloads) -> **208/208**.
- Nodes: 98 (one button removed).

## v4.12.5 (99 nodes)

Editor-canvas tidy after reviewing the v4.12.3/v4.12.4 layout passes (no runtime change):

- The v4.12.3 repack left two canvas nits: the **Available** field (`wpu0008`) at off-grid (206,320), and the **Password** input (`wpu0006`) sharing cell (700,720) with the `POST /auth/token` http node (`wpu0013`). Moved to (380,320) and (700,800) — both on the 320x80 grid, no collisions. Dashboard rendering is unaffected (it is driven by group/order/width, not canvas coordinates).
- Harness T23 gains two structural asserts (zero same-cell collisions, zero off-grid placed nodes) -> **198/198**.
- Tab node `version`, `version.json` and the boot inject payload (`Running: <version>`) bumped to 4.12.5 together, so a running 4.12.4 tab self-updates to this via [Update tab].

## v4.12.4 (99 nodes)

Drives two live findings after the first real self-update in production: (1) a raw.githubusercontent CDN edge served the v4.12.2 file hours after the v4.12.3 push, so the tab kept offering an update that was (or should have been) running already — "after update it still shows that i have to update"; (2) the two update concepts were still both just called "update".

- **CDN cache-busters on every pinned raw fetch**: this repo's `version.json`, the self-update `update-tab.json` download, the package `version.json` and the package `flowUrl` all now append `?cb=<epoch>` at fetch time, so a stale CDN edge can never serve an outdated version comparison again. The allowlist validation still checks the clean stored URL (the buster is added only when the request is built).
- **Boot refresh of the Tab version field**: a once-per-start inject sets the field to `"Running: <version>"` 15 seconds after every flow start, so after a restart or a self-update the field shows the truth instead of a stale "(update!)" from the last check. The harness asserts the payload stays equal to the tab node version and `version.json`.
- **Flow vs tab terminology** (user-visible strings and buttons): the package is now consistently "the flow" and this dashboard tab is "the tab" — [Check for updates] -> [Check flow version], [Run update] -> [Update flow], Status -> Flow status, [Update this tab] -> [Update tab], divider caption "Tab updater" -> "This tab". All in-flow messages swept: several user-facing errors still pointed at pre-v4.12 button names ("[Check for update] and [RUN UPDATE]"); the deploy messages are now phase-aware ("Tab update succeeded: ..." vs "Flow update succeeded: ...", each with an appropriate closing line; wpu0096 tags its POST with `_phase: "selfupdate"`).
- Harness: T21/T22 moved to the new wording, new section **T23** (buster on all four fetches, boot-inject sync, phase-aware deploy texts, zero stale vocabulary, node count) -> **196/196**.
- Nodes: 99 (one inject added).

## v4.12.3 (98 nodes)

Layout and wording, driven by a live screenshot of the tab in the dashboard: on a wide screen node-red-dashboard had placed all four width-6 sections next to each other in a single row, and the width-3 button labels rendered truncated ("CHECK UPDATER VER", "UPDATE THE UPDATE").

- **Two fixed columns instead of fluid sections**: exactly two `ui_group`s ("Update", width 6, order 1; "Backup & admin", width 6, order 2). With only two groups, node-red-dashboard always renders this tab as two columns side by side (each about half the screen) and stacks them into one column on narrow screens. The old Updater and Admin sections survive as sub-sections behind an Ed-style `ui_template` divider (the same `<hr>` idiom the HeishaMoNR dashboard itself uses), captioned "Tab updater" and "Admin".
- **Widgets repacked for the 6-unit columns**: every button now fills a full 6-unit row, so labels never truncate again; Installed + Available share one 3+3 row; all fields stay full width.
- **Consistent wording** (user-visible labels and messages): the tab is now consistently "the tab" — [Update the updater] -> [Update this tab], [Check updater version] -> [Check tab version], the "Updater" field -> "Tab version", the status text "Updater: ..." -> "Tab: ...", "the updater version.json" -> "version.json"; [Check for update] -> [Check for updates], RUN UPDATE -> Run update (and it drops its custom red styling: one button silently carrying its own color scheme read as an inconsistency, all buttons now use the theme default), [Backup settings] -> [Back up settings], [Download flow] -> [Download flows] (anchor text too), Admin inputs -> "User (optional)" / "Password (optional)" under the Admin divider.
- Harness: T22 rewritten (two groups, no ragged rows, full-width buttons, a fits-its-width label assert, divider asserts, the agreed button wording set, exactly three "(optional)" inputs), T21 updated for the two groups -> **184/184**.
- Nodes: still 98 (two `ui_group`s removed, two `ui_template` dividers added).

# Changelog

All dates are 21 Nov 2026: this tab was built, reviewed and hardened in one day. Key facts per version: the button behaviour and merge rules are stable since v4.6; earlier versions are mostly of historical interest. (v4.12.x follow-ups: 22 Nov 2026.)

## v4.12.2 (98 nodes)

Compact layout, per user feedback ("not happy with the horizontal alignment, whole tab too stretched"):

- **Compact half-width sections**: all four `ui_group`s drop from width 12 (full-width, everything stretched across the screen) to **6 units**, the DB1 default block size. Two sections sit side by side per browser row once the window is wide enough (Update + Updater on the first row, Backup & export + Admin below), wrapping to one column on narrow screens. Verified against the node-red-dashboard grid documentation: groups of width 6 sit alongside each other on a wide browser, one unit is 48 px + 6 px gap.
- **Widgets repacked for the 6-wide groups**: Update = Check(3) + RUN(3), Installed(3) + Available(3), Status(6); Updater = Check(3) + Update(3), Updater field(6); Backup & export = Backup(3) + Restore(3), Confirm(3) + Download(3), Backup folder(6); Admin = user(6) and password(6), each a full row. Every section packs into full 6-wide rows, no ragged wrapping.
- **"by agreement" retracted**: the v4.12.0 entry said the Dutch code comments stayed "by agreement". There was no such agreement; the sentence below is corrected. The Dutch comments were fully removed in v4.12.1 anyway.
- Harness: T22 updated for the 6-wide groups, plus a new assert that all four sections are half-width (6) -> **178/178**.
- Tab node `version` and `version.json` bumped to 4.12.2, so a running 4.12.0/4.12.1 tab offers this update via [Update the updater] itself.

## v4.12.1 (98 nodes)

Layout consistency, English throughout, and an honest correction:

- **Consistent grid**: the Update section left a ragged row: Check(4) + RUN(4) + Installed(3) + Available(3) summed to 14 columns, so Available wrapped onto a ragged second row next to the 8-wide Status field. Fixed: Installed/Available are 2 columns each (Check 4 + RUN 4 + Installed 2 + Available 2 = one full 12-column row), Status is full width (12); the Admin inputs are 6+6; the Backup & export bottom row is Download flow(4) + Backup folder(8) = 12. Every section now packs into full 12-wide rows (new harness section T22).
- **English code comments and stats keys**: the "No more Dutch" request went further than the v4.12.0 UI-string pass. The remaining ~180 Dutch code comments across 22 function nodes are translated to English, and the internal merge-statistics keys `{nieuw, bijgewerkt, verwijderd, ongewijzigd}` renamed to `{added, updated, removed, unchanged}` (producers `wpu0030`/`wpu0096`, consumer `wpu0031`). No user-visible behavior change; zero Dutch left in comment lines, code lines and user-visible fields (all three now asserted).
- **Correction of the v4.12.0 "Download fix" claim** (retracted on evidence): that bullet claimed `wpu0029`/`wpu0085` previously exported `headers: []` (array), which made Node-RED 5.x drop the serve functions' `msg.headers`. Both parts are wrong. (1) The v4.11.2 -> v4.12.0 diff does not touch the download path, and v4.11.2 already exported `headers: {}` (empty object) on both nodes. (2) The Node-RED 5.0.1 runtime source (`@node-red/nodes` core/network/21-httpin.js, `HTTPOut`) merges every `msg.headers` entry over `this.headers = n.headers || {}` unconditionally, so the function-provided `Content-Type` + `Content-Disposition: attachment` were sent before v4.12.0 as well. The browser downloads (backup, flow) work and always did via the function-set headers; the v4.12.0 commit's "download fix" changed nothing on this path. The harness keeps asserting the empty-object headers and the Content-Disposition strings.
- Harness: stats-key asserts renamed to the English keys; new section **T22** (full 12-wide row packing per section, including the string-typed `ui_group` width `"12"`; the section width fixes; English stats keys in producers and consumer; zero Dutch in code comments and code lines) -> **176/176**.
- Tab node `version` and `version.json` bumped to 4.12.1, so a running 4.12.0 tab offers this update via [Update the updater] itself.

## v4.12.0 (98 nodes)

Layout, UX parity and the download fix:

- **Sectional dashboard**: four `ui_group` sections in order 1-4 — **Update** (Check for update / RUN UPDATE + Installed/Available/Status), **Updater** (new [Check updater version] button `wpu00a0` topic `selfcheck`, [Update the updater] `wpu0090`, new **Updater** version field `wpu00a1`), **Backup & export** (Backup settings / Restore / Download flow / Backup folder), **Admin** (user/password). Buttons in one column, inputs/readouts in the next; 10 section comment nodes on the right rail. No same-cell collisions, all nodes on the 320x80 grid, no dangling wires.
- **Updater check-then-apply UX parity** (same as the package update: check shows versions, the update button applies): [Check updater version] only fetches the pinned updater `version.json` and displays `current -> available (update!)/(up to date)` in the Updater field (`wpu0093` out2 -> `wpu00a1`) — it never downloads. Only [Update the updater] (topic `selfupdate`) downloads and applies when newer (`wpu0093` out1 -> `wpu0094`). Bug fixed in `wpu0015`: the out5 phase was hardcoded to `selfupdate`, so a mere version check would also have triggered the download; it now preserves the incoming phase (`selfcheck` stays `selfcheck`).
- **Download fix** ("download flow doesn't download onto the browser device"): the two `http response` nodes (`wpu0029` for `/wpupdate/backup`, `wpu0085` for `/wpupdate/flows`) had `headers: []` (array) in the exported config. On Node-RED 5.x that makes the node ignore the `msg.headers` set by the serve functions, so `Content-Type`/`Content-Disposition: attachment` were never sent and the browser rendered the JSON in the tab instead of saving it. Both nodes now carry `headers: {}` (empty object) — verified live on Node-RED 5.0.10: function-set headers are sent. Clicking the private toast link now downloads the file.
- **Remaining Dutch translated to English** (Ed's package UI is English): node names (`wpu0017` "GET repo page (fallback)", `wpu0018` "GET new flow.json", `wpu0064`/`wpu070` "error: download"/"error: snapshot", `wpu0076` "Message (this client)") and user-visible function literals (`"onbekend"` -> `"unknown"` incl. the phantom-update guard in `wpu0019`, "while version", "Internal error: duplicate node id after merge", "Possibly renamed; check manually", "(via repo scan)"). Code comments stayed Dutch at this point (they were fully removed in v4.12.1; there was no agreement to keep them).
- Harness: T18 updated for the phase-gated download (`_phase: 'selfupdate'` required for the download assert; `selfcheck` displays only; `up to date` display text) + new section **T21** (4 groups with names/orders, every widget assigned to a group, `wpu00a0`/`wpu00a1`/`wpu0090` wiring, `wpu0093`/`wpu0015` wire shapes, response-node `headers` deep-equal `{}`, Content-Disposition in the serve functions, tab version === version.json, no Dutch in user-visible fields) -> **167/167**.
- Tab node `version` and `version.json` bumped to 4.12.0, so a running 4.11.2 tab offers this update via [Update the updater] itself.

## v4.11.2 (83 nodes)

Error-reporting audit (question: "are errors properly logged and shown on screen?"). Systematic trace of every failure path:

- **On screen, complete**: every error class (admin login, read flows, download, network, merge/deploy prep, inspection, snapshot, restore, file read, self-update validate/merge, flowdl dump) reaches the error hub `wpu074` -> `wpu0040`, which sets the persistent **Status** field on the dashboard (`wpu0009`), broadcasts a toast (`wpu0035`, 5 s, top-right) and writes a `node.warn` to the Node-RED log. The Status field keeps the last error readable long after the toast is gone.
- **One gap closed**: the deploy *response* (checked by `wpu0031`) produced a toast + Status for 409 rev conflicts and failed POSTs, but wrote NOTHING to the container log — while the toast text claimed "full message in the Node-RED debug/log". A successful deploy was not in the log either, so when the success toast was lost to the flow self-replacing itself there was no confirmation line at all.
- Fix in `wpu0031`: success logs `[WP Update] deploy OK (HTTP …)`; 409 and generic failures `node.warn` the status + the Admin API response body (truncated to 300 chars). The toast's log reference is now true.
- Harness: `makeCtx` now captures `node.log/warn/error`, new section **T20** (success-OK-line, no-warn-on-success, 409-warn-with-body, generic-fail-warn-with-body) -> **149/149** (4 new asserts).
- Tab node `version` and `version.json` bumped to 4.11.2.

## v4.11.1 (83 nodes)

Post-v4.11 sanity check (full audit of HEAD: structure, English claim, self-update chain): the tab itself, the validation rules and the wpu-only merge are sound. One real gap found: the three new self-update `http request` nodes (`wpu0092` version.json, `wpu0094` update-tab.json, `wpu0097` palette GET /nodes) were **not in the catch scope of `wpu0059`**, so a network-level failure (DNS, GitHub unreachable, timeout) stopped the chain with no toast at all — only a silent "no catch node" line in the Node-RED log. Every http request node had been covered since the v4.7 fix; v4.11.0 added these three without extending the scope.

- Fix: `wpu0059.scope` now also lists `wpu0092`, `wpu0094`, `wpu0097` — a network error during "Update the updater" produces the same readable toast as every other http failure (wpu005a reads `msg.error.message` from the runtime; HTTP-error statuses were already handled per node by `wpu0093`/`wpu0095`/`wpu0096`).
- Harness: new structural section **T19** asserts every `http request` node is in the `wpu0059` scope and every `file`/`file in` node in the `wpu0056` scope -> **145/145** (3 new asserts).
- Tab node `version` and `version.json` bumped to 4.11.1 so the running v4.11.0 tab offers this update via [Update the updater] itself (first live proof of the self-update chain).

## v4.11.0 (83 nodes)

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
