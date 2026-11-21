# HeishaMon NR update tab

An importable Node-RED tab for [HeishaMoNR](https://github.com/edterbak/HeishaMoNR) that turns every package update into a four-click dashboard job: **Check for update**, **Backup settings**, **Restore**, **Update now**.

Latest flow: [`update-tab.json`](update-tab.json) (v4.7, 69 nodes, one flow tab with its own `ui_tab`/`ui_group`; live-tested against the real 26.3.1 and 26.5.1 packages, 127/127 checks green).

## What it does

- Version check from `version.json` in the repo root (recommended), with a repo-page scan fallback that needs no GitHub API.
- Full global-context backup to a timestamped file plus a fixed `latest` copy, downloadable via a one-time token at `/wpupdate/backup`.
- Two-click restore that works after a Node-RED restart, and writes a pre-restore snapshot first so the restore itself is reversible.
- Id-based atomic merge via the Admin API (palette pre-flight, rev conflict detection, pre-update flow snapshot), preserving the local MQTT broker config and all personal tabs.
- Readable dashboard errors for network-level failures (DNS/connection errors carry no status code) instead of failing silently.

## Import (one-time)

1. In Node-RED: menu, Import, paste/upload `update-tab.json`, "Import to new flow tab", Deploy.
2. Open the **WP Update** dashboard tab, enter Synology Node-RED admin credentials once (or set `WPU_ADMIN_USER`/`WPU_ADMIN_PASS` environment variables in the container).
3. Smoke test: press **Check for update**.

Re-importing an older copy of the tab? Delete the old flow tab first (including its `ui_tab`/`ui_group` under Configuration Nodes) so ids stay unique.

## Feature request / draft PR: self-service update tab

The current update procedure (manual tab deletion, config cleanup, screenshots for settings) is error-prone and costs every user 30+ minutes per release. Since node ids are already stable across releases (verified: 26.3.1 -> 26.5.1 share 3547 ids; 1 removed, 15 added), a scripted atomic update is safe. This tab ships inside the flow package and reduces every future update to the four steps above. Admin credentials can come from environment variables instead of the dashboard fields, so no password needs to sit in the editor or context.

The tab ships with a repo-scan fallback (reads the plain repo page, picks the highest `flows (X stable).json`, no GitHub API, so no rate limits) and therefore works with the repo as it is today. It is also robust against a fully rebuilt release (all-new node ids, which the repo has not done so far but could): flow tabs are additionally matched on their stable labels, placeholder MQTT broker references are rescued to the locally most-used broker, and leftover old dashboard items are reported rather than silently deleted. Recommended addition: a `version.json` in the root, updated per release (generation can be automated in CI):

```json
{ "version": "...", "flowUrl": "https://raw.githubusercontent.com/.../flows (X stable).json", "notes": "..." }
```

The pre-flight reads `GET /nodes` with `Accept: application/json` (required by the editor API) and only counts enabled, error-free node sets; tab/group/junction/subflow instances are flow-config types, not palette types. Before every deploy the current flows are written to a pre-update snapshot (`wp-preupdate-flows-<timestamp>.json`) as a rollback next to the rev conflict check. Backups go to an optional backup directory (`/data` in Docker) and the download endpoint requires a one-time token from the toast, because http nodes are not covered by adminAuth. Download URLs from `version.json` are pinned to the repo, releases are X.Y.Z only, and before merging the changelog node inside the downloaded flow must report the expected version (wrong file or forgotten bump = refused, nothing changed). Download tokens expire after 24 hours; admin tokens are refreshed hourly. The tab-swap by label only applies when no local tab with that label matches on id (a personal tab coincidentally named like a package tab survives an id-stable release). A successful deploy covers the deploy operation; the pre-update flow snapshots are the recovery path if the new flows fail at startup. If this tab ships inside the package itself, an id-stable release self-updates it cleanly; a locally renamed copy with different ids would remain as a duplicate tab and needs a one-time manual cleanup. The tab follows the existing in-flow Admin API precedent (the GUI_01/GUI_02 tab-toggle already uses `PUT /flow/:id`).
