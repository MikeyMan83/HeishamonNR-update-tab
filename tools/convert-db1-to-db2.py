#!/usr/bin/env python3
"""Convert a node-red-dashboard (DB1, /ui) flow JSON to @flowfuse/node-red-dashboard (DB2, /dashboard).

Minimal-diff, id-preserving conversion:
  - ui_tab    -> ui-page   (SAME id, so every existing z reference stays valid; core auto-creates
                            the synthetic flow scope for a z pointing at a config node)
  - ui_group  -> ui-group  (tab -> page, width -> int, showTitle = disp)
  - widgets   -> ui-*      (type map below; icon 'fa-x' -> 'x'; ui_text layout col-left -> col-center;
                            ui_toast -> ui-notification with ui='' and displayTime as string, 'raw'
                            maps 1:1; ui_ui_control -> ui-control is flagged for MANUAL rework)
  - no ui-base / ui-theme is created: assign page + notification nodes to the single ui-base in the
    editor's Dashboard 2.0 sidebar after import (shipping a second base breaks widget wiring).
  - logic nodes (function, http, mqtt, ...) and config nodes (mqtt-broker, global-config) are untouched.

Usage:
  python3 tools/convert-db1-to-db2.py <in.json> <out.json>

Prints a validation report: duplicate ids, dangling wires/links, bad z/group/page/ui refs,
palette type list (for the GET /nodes pre-flight), conversion counts, and the list of nodes that
need manual review. Exit code 1 if validation fails.

Field mappings verified against flowfuse/node-red-dashboard @ main (nodes/config/ui_page.html,
ui_group.html, nodes/widgets/ui_*.html) and FlowFuse/node-red-dashboard-2-migration transformers.
"""
import json
import re
import sys

WIDGET_MAP = {
    "ui_button": "ui-button",
    "ui_text": "ui-text",
    "ui_text_input": "ui-text-input",
    "ui_numeric": "ui-number-input",   # DB2 type is ui-number-input
    "ui_dropdown": "ui-dropdown",
    "ui_switch": "ui-switch",
    "ui_slider": "ui-slider",
    "ui_form": "ui-form",
    "ui_chart": "ui-chart",
    "ui_gauge": "ui-gauge",
    "ui_table": "ui-table",
    "ui_template": "ui-template",       # DB1 'format' field carries over (DB2 also uses 'format')
    "ui_toast": "ui-notification",
    "ui_ui_control": "ui-control",
    "ui_audio": "ui-audio",
}

DB2_BREAKPOINTS = [
    {"name": "Default", "px": 0, "cols": 3},
    {"name": "Tablet", "px": 576, "cols": 6},
    {"name": "Small Desktop", "px": 768, "cols": 9},
    {"name": "Desktop", "px": 1024, "cols": 12},
]


def kebab(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-") or "page"


def convert_tab(n, order):
    # NB: the core `tab` node (flow scope, target of every node's z) is kept untouched;
    # the ui_tab config node becomes the ui-page with the SAME id, so ui_group 'tab' refs
    # (which point at the ui_tab id) stay valid as 'page' refs.
    n["type"] = "ui-page"
    n["name"] = n.get("name") or n.get("label") or n["id"]
    n["path"] = "/" + kebab(n.get("name") or n.get("label") or n["id"])
    n["ui"] = ""          # assign to the single ui-base in the editor's Dashboard 2.0 sidebar
    n["layout"] = "grid"
    n["theme"] = ""
    n["breakpoints"] = DB2_BREAKPOINTS
    n["order"] = n.get("order", order)
    n["className"] = n.get("className") or ""
    n["visible"] = not n.get("disabled", False)
    if isinstance(n.get("icon"), str):
        n["icon"] = re.sub(r"^fa-", "", n["icon"])
    for k in ("hidden", "disp", "collapse"):
        n.pop(k, None)


def convert_group(n):
    n["type"] = "ui-group"
    n["page"] = n.pop("tab")
    n["showTitle"] = n.get("disp", True)
    try:
        n["width"] = int(n.get("width", 6))
    except (TypeError, ValueError):
        n["width"] = 6
    n["height"] = "1"
    n["visible"] = True
    n["disabled"] = False
    n["groupType"] = "default"
    for k in ("tab", "disp", "collapse"):
        n.pop(k, None)


def convert_widget(n, manual, counts):
    old = n["type"]
    n["type"] = WIDGET_MAP[old]
    n.pop("tab", None)  # stale DB1 field; DB2 widgets bind via group (+ z flow scope)
    if isinstance(n.get("icon"), str):
        n["icon"] = re.sub(r"^fa-", "", n["icon"])
    for k in ("width", "height"):
        if k in n:
            try:
                n[k] = int(n[k])
            except (TypeError, ValueError):
                pass
    if n["type"] == "ui-text" and n.get("layout") == "col-left":
        n["layout"] = "col-center"  # DB2 has no col-left
    if old == "ui_button":
        n.pop("passthru", None)
    if old == "ui_switch":
        for k in ("tooltip", "decouple", "animate"):
            n.pop(k, None)
    if old == "ui_toast":
        n["ui"] = ""
        if "displayTime" in n:
            n["displayTime"] = str(n["displayTime"])
        for k in ("sendall", "ok", "cancel", "highlight"):
            n.pop(k, None)  # 'raw' maps 1:1 (DB2 ui-notification has raw); private targeting via msg.socketid/_client
        if n.get("sendall") is False:
            manual.append((n["id"], "ex-ui_toast was PRIVATE (sendall=false): DB2 private targeting rides on "
                                   "msg.socketid/msg._client in the msg - verify the sender sets it"))
        else:
            counts["ui_toast auto-ok (broadcast; raw maps 1:1)"] = counts.get("ui_toast auto-ok (broadcast; raw maps 1:1)", 0) + 1
    if old == "ui_ui_control":
        n["ui"] = ""
        manual.append((n["id"], "ex-ui_ui_control -> ui-control: DIFFERENT model (DB2 nav is pages/sidebar) - "
                               "manual rework, usually ui-link or payloadType 'navigate'"))
    if old == "ui_template":
        fmt = n.get("format") or ""
        if re.search(r"ng-[a-z]|ngModel|\|\s*(filter|date|number|currency|json|limitTo)", fmt, re.I):
            manual.append((n["id"], "ex-ui_template with AngularJS (ng-*/filters) - DB2 uses Vue: rewrite bindings manually"))
        else:
            counts["ui_template auto-ok (plain HTML/{{msg}})"] = counts.get("ui_template auto-ok (plain HTML/{{msg}})", 0) + 1


def convert(flow):
    counts = {}
    manual = []
    pages = [n for n in flow if n.get("type") == "ui_tab"]
    for i, n in enumerate(pages):
        convert_tab(n, i + 1)
        counts["ui_tab->ui-page"] = counts.get("ui_tab->ui-page", 0) + 1
    for n in flow:
        if n.get("type") == "ui_group":
            convert_group(n)
            counts["ui_group->ui-group"] = counts.get("ui_group->ui-group", 0) + 1
    for n in flow:
        t = n.get("type")
        if t in WIDGET_MAP:
            convert_widget(n, manual, counts)
            counts[t + "->" + WIDGET_MAP[t]] = counts.get(t + "->" + WIDGET_MAP[t], 0) + 1
        elif t == "ui_base":
            manual.append((n["id"], "DB1 ui_base present: do NOT ship a second DB2 ui-base - remove this node "
                                   "and assign pages/notifications to the add-on's single ui-base in the sidebar"))
        elif isinstance(t, str) and t.startswith("ui_") and t not in ("ui_tab", "ui_group", "ui_base"):
            manual.append((n["id"], "unsupported DB1 type '" + t + "' left unchanged - will be an unknown type in DB2"))
    return counts, manual


def validate(flow, baseline_links=None):
    errs = []
    warns = []
    baseline_links = baseline_links or set()
    ids = [n.get("id") for n in flow]
    dup = {i for i in ids if i and ids.count(i) > 1}
    if dup:
        errs.append("duplicate ids: " + ", ".join(sorted(dup)))
    byid = {n.get("id"): n for n in flow}
    page_ids = {n["id"] for n in flow if n.get("type") == "ui-page"}
    group_ids = {n["id"] for n in flow if n.get("type") == "ui-group"}
    base_ids = {n["id"] for n in flow if n.get("type") == "ui-base"}
    for n in flow:
        nid = n.get("id")
        for w in (n.get("wires") or []):
            for t in w:
                if t not in byid:
                    errs.append("dangling wire %s -> %s" % (nid, t))
        if n.get("type") == "link out":
            for t in (n.get("links") or []):
                if t not in byid:
                    # Node-RED tolerates one-sided links; only fail if the conversion created one
                    if (nid, t) in baseline_links:
                        warns.append("pre-existing dangling link %s -> %s (also in source)" % (nid, t))
                    else:
                        errs.append("dangling link %s -> %s" % (nid, t))
        z = n.get("z")
        if z is not None and n.get("type") not in ("ui-page", "ui-group", "ui-base", "ui-theme", "subflow", "tab") \
                and (z not in page_ids and (byid.get(z) is None or byid[z].get("type") not in ("tab", "ui-page", "subflow"))):
            errs.append("bad z %s -> %s (not a tab/ui-page/subflow)" % (nid, z))
        if n.get("type") == "ui-group" and n.get("page") not in page_ids:
            errs.append("group %s bad page ref %s" % (nid, n.get("page")))
        if isinstance(n.get("type"), str) and n["type"].startswith("ui-") and n.get("type") not in ("ui-page", "ui-group", "ui-base", "ui-theme", "ui-link", "ui-notification", "ui-control") \
                and "group" in n and n.get("group") not in group_ids:
            errs.append("widget %s bad group ref %s" % (nid, n.get("group")))
        if "ui" in n and n["ui"] not in ("",) and n["ui"] not in base_ids:
            errs.append("node %s bad ui-base ref %s" % (nid, n["ui"]))
    palette = sorted({n.get("type") for n in flow if n.get("type")})
    return errs, warns, palette


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    src, dst = sys.argv[1], sys.argv[2]
    flow = json.load(open(src, encoding="utf-8"))
    baseline_links = {(n.get("id"), t) for n in flow if n.get("type") == "link out" for t in (n.get("links") or [])}
    counts, manual = convert(flow)
    errs, warns, palette = validate(flow, baseline_links)
    json.dump(flow, open(dst, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print("converted %d nodes -> %s" % (len(flow), dst))
    print("\nconversion counts:")
    for k in sorted(counts):
        print("  %-28s %d" % (k, counts[k]))
    print("\npalette types needed (check against GET /nodes before deploy):")
    print("  " + ", ".join(palette))
    print("\nmanual review needed (%d):" % len(manual))
    for nid, why in manual:
        print("  %s: %s" % (nid, why))
    if warns:
        print("\npre-existing warnings carried over from source (%d), e.g.:" % len(warns))
        for e in warns[:5]:
            print("  WARN " + e)
    if errs:
        print("\nVALIDATION ERRORS (%d):" % len(errs))
        for e in errs[:50]:
            print("  ERR " + e)
        sys.exit(1)
    print("\nvalidation: OK (no duplicate ids, no NEW dangling wires/links, all z/group/page/ui refs resolve)")


if __name__ == "__main__":
    main()
