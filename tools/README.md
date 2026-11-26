# tools/convert-db1-to-db2.py

Deterministic, id-preserving converter from node-red-dashboard (DB1, `/ui`) flow JSON to
@flowfuse/node-red-dashboard (DB2, `/dashboard`) flow JSON.

Usage:
    python3 tools/convert-db1-to-db2.py <flows-db1.json> <out-db2.json>

What it does:
- `ui_tab` -> `ui-page` IN PLACE (same id, so every existing `z`/`group`/`tab` reference stays valid);
  core `tab` nodes are kept as flow scopes. `ui_group` -> `ui-group` (`tab` -> `page`).
- Widget type map (DB2 names verified against the @flowfuse package source): ui_button->ui-button,
  ui_text->ui-text (layout col-left->col-center), ui_text_input->ui-text-input, ui_numeric->ui-number-input,
  ui_dropdown->ui-dropdown, ui_switch->ui-switch, ui_slider->ui-slider, ui_form->ui-form, ui_chart->ui-chart,
  ui_gauge->ui-gauge, ui_table->ui-table, ui_template->ui-template, ui_toast->ui-notification,
  ui_ui_control->ui-control, ui_audio->ui-audio. Icons `fa-x` -> `x`; widths/heights normalized to int.
- Ships NO ui-base/ui-theme: after import, assign pages + notifications to the single ui-base in the
  editor's Dashboard 2.0 sidebar (a second base breaks widget wiring).
- Prints a validation report: conversion counts, palette type list (for the GET /nodes pre-flight),
  duplicate-id / dangling wire/link checks (vs source baseline), z/group/page/ui ref checks, and the
  manual-review list (templates, toasts, ui_control).

Deploy protocol (production): snapshot current flows -> POST /flows {flows: converted, rev} with
Node-RED-Deployment-Type: full (atomic, 409 = retry) -> assign ui-base in sidebar -> check /dashboard.
Rollback: re-POST the snapshot. Convert from the on-disk flows.json (keeps credentials encrypted),
NEVER from GET /flows (strips credential-store secrets).

## Verification status (26 Nov 2026)
- Static: run on real `flows (26.5.1 stable).json` -> 3562 nodes, 16 pages, 61 groups, 982 widgets,
  628 functions parse, 0 new dangling refs, every ui-* type present in @flowfuse/node-red-dashboard 1.37.0,
  0 leftover DB1 ui_* types; 172 nodes flagged for manual review (149 templates, 16 toasts, 7 ui_control).
- Live: scratch Node-RED 5.0.10 + node-red-dashboard 3.6.6 + @flowfuse/node-red-dashboard 1.37.0,
  converted file deployed via POST /flows (v2, rev, full) -> 200; all 16 pages served at
  /dashboard/<path> (200), zero ui-base/ui-page/ui-group registration errors; original DB1 file
  on a second instance still serves /ui (200). Remaining manual work: 172 flagged nodes + visual check.
