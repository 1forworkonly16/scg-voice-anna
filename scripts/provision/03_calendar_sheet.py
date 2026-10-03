"""WP5 steps 4-5, service-account only (no gws, no user OAuth).
  Calendar: SA creates «SCG — Бесплатный осмотр» (Europe/Riga), then shares it with the owner's Google account (writer,
            e-mail notification so the owner can add it on the phone).
  Sheet:    the owner creates «SCG Leads» and shares it with the SA as Editor; pass --sheet-url / --sheet-id.
            The SA adds the missing tabs (SHEET_TABS), writes header rows from src/google/sheet_schema.ts (RAW),
            reads them back, and removes the default empty Sheet1/Лист1.
Idempotent; ids go to state.json. The SA key comes from the user env var GOOGLE_SA_KEY_JSON (never printed).
Run: PYTHONUTF8=1 python scripts/provision/03_calendar_sheet.py [--calendar-only] [--sheet-only] [--new-tabs-only] [--sheet-url URL | --sheet-id ID]
  --sheet-only      skip the calendar step (no calendar or ACL call at all).
  --new-tabs-only   ADDITIVE mode for a live Sheet: only the tabs created in THIS run get frozen row + header row; existing tabs are
                    only read back and compared (never written). Fails if a tab that already existed has different headers."""
import json, os, re, sys, urllib.error, urllib.parse, urllib.request
from _common import *

CAL_NAME = "SCG — Бесплатный осмотр"
OLD_CAL_NAMES = ["SCG — Осмотры (демо)"]
TABS = ["Leads", "Calls", "Works", "Access", "Callbacks", "Tickets", "Requests"]
DEFAULT_TABS = {"Sheet1", "Лист1", "Sheet 1", "Лист 1"}
SCOPES = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets"
NODE = shutil.which("node")
_token = None


def token():
    global _token
    if _token:
        return _token
    key = get_user_env("GOOGLE_SA_KEY_JSON") or os.environ.get("GOOGLE_SA_KEY_JSON")
    if not key:
        raise SystemExit("GOOGLE_SA_KEY_JSON missing (run 02_sa_key.py)")
    env = dict(os.environ, GOOGLE_SA_KEY_JSON=key)
    p = subprocess.run([NODE, str(HERE / "sa_token.mjs"), SCOPES], capture_output=True, text=True, env=env)
    if p.returncode != 0:
        raise SystemExit("SA token failed: " + p.stderr.strip()[:300])
    _token = p.stdout.strip()
    return _token


class ApiError(Exception):
    def __init__(self, status, body):
        self.status, self.body = status, body
        err = body.get("error", {}) if isinstance(body, dict) else {}
        self.reason = (err.get("errors") or [{}])[0].get("reason") or err.get("status") or str(status)
        super().__init__(f"HTTP {status} {self.reason}: {str(err.get('message', body))[:300]}")


def api(method, url, body=None, params=None):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        try:
            b = json.loads(e.read().decode("utf-8"))
        except Exception:
            b = {}
        raise ApiError(e.code, b) from None


CAL = "https://www.googleapis.com/calendar/v3"
SHEETS = "https://sheets.googleapis.com/v4/spreadsheets"


def headers():
    """Header rows come ONLY from src/google/sheet_schema.ts (single source of truth, never hand-copied)."""
    f = HERE.parent.parent / "src/google/sheet_schema.ts"
    txt = f.read_text(encoding="utf-8")
    out = {}
    for tab in TABS:
        m = re.search(r"export\s+const\s+%s_HEADERS\s*=\s*\[(.*?)\]\s*as\s+const" % tab.upper(), txt, re.S)
        if not m:
            raise SystemExit(f"{tab.upper()}_HEADERS not found in sheet_schema.ts")
        out[tab] = re.findall(r'"([^"]+)"', re.sub(r"//[^\n]*", "", m.group(1)))
    m = re.search(r"SHEET_TABS\s*=\s*\{(.*?)\}\s*as\s+const", txt, re.S)
    order = re.findall(r"(\w+)\s*:", m.group(1))
    if order != TABS:
        raise SystemExit(f"SHEET_TABS order {order} != {TABS}")
    return out


def calendar(st, owner):
    cid = st.get("calendar_id")
    if cid:
        try:
            api("GET", f"{CAL}/calendars/{urllib.parse.quote(cid)}")
        except ApiError as e:
            if e.status in (403, 404):
                cid = None
            else:
                raise
    if not cid:
        items = api("GET", f"{CAL}/users/me/calendarList").get("items", [])
        cid = next((i["id"] for i in items if i.get("summary") in [CAL_NAME, *OLD_CAL_NAMES] and i.get("accessRole") == "owner"), None)
    if not cid:
        cid = api("POST", f"{CAL}/calendars", {
            "summary": CAL_NAME, "timeZone": "Europe/Riga",
            "description": "Демо: записи на бесплатный осмотр (ИИ-ассистент Анна). ДЕМО"})["id"]
        print("calendar created")
    else:
        print("calendar exists")
    st["calendar_id"] = cid
    save_state(st)
    q = urllib.parse.quote(cid)
    acl = api("GET", f"{CAL}/calendars/{q}/acl").get("items", [])
    if not any(a.get("scope", {}).get("value", "").lower() == owner.lower() and a.get("role") in ("writer", "owner") for a in acl):
        api("POST", f"{CAL}/calendars/{q}/acl", {"role": "writer", "scope": {"type": "user", "value": owner}},
            params={"sendNotifications": "true"})
        print("owner ACL inserted (notification e-mail sent)")
        acl = api("GET", f"{CAL}/calendars/{q}/acl").get("items", [])
    else:
        print("owner ACL already present (no new notification)")
    cal = api("GET", f"{CAL}/calendars/{q}")
    if cal.get("summary") != CAL_NAME:
        cal = api("PATCH", f"{CAL}/calendars/{q}", {"summary": CAL_NAME})  # no ACL change, no e-mail
        print("calendar renamed to", CAL_NAME)
    roles = [(a.get("scope", {}).get("type"), a.get("role"),
              "owner-account" if a.get("scope", {}).get("value", "").lower() == owner.lower() else "sa/other") for a in acl]
    print("calendar summary:", cal.get("summary"), "| tz:", cal.get("timeZone"))
    print("ACL (type, role, who):", roles)
    assert cal.get("summary") == CAL_NAME
    assert cal.get("timeZone") == "Europe/Riga"
    assert any(r[1] == "writer" and r[2] == "owner-account" for r in roles)


def sheet(st, sid, new_only=False):
    hdr = headers()
    q = f"{SHEETS}/{sid}"
    meta = api("GET", q, params={"fields": "sheets.properties(sheetId,title)"})
    props = [s["properties"] for s in meta["sheets"]]
    have = [p["title"] for p in props]
    missing = [t for t in TABS if t not in have]
    if missing:
        api("POST", q + ":batchUpdate", {"requests": [{"addSheet": {"properties": {"title": t}}} for t in missing]})
        print("added tabs:", missing)
        props = [s["properties"] for s in api("GET", q, params={"fields": "sheets.properties(sheetId,title)"})["sheets"]]
    # remove default sheet only if empty
    for p in props:
        if p["title"] in DEFAULT_TABS and p["title"] not in TABS:
            vals = api("GET", f"{q}/values/{urllib.parse.quote(p['title'] + '!A1:Z50')}").get("values", [])
            if not vals and len(props) > 1:
                api("POST", q + ":batchUpdate", {"requests": [{"deleteSheet": {"sheetId": p["sheetId"]}}]})
                print("deleted empty default tab", p["title"])
            else:
                print("default tab", p["title"], "not empty or only tab: kept")
    ids = {x["properties"]["title"]: x["properties"]["sheetId"] for x in api("GET", q, params={"fields": "sheets.properties(sheetId,title)"})["sheets"]}
    write_tabs = missing if new_only else TABS  # additive mode: never write to a tab that already existed
    if write_tabs:
        api("POST", q + ":batchUpdate", {"requests": [
            {"updateSheetProperties": {"properties": {"sheetId": ids[t], "gridProperties": {"frozenRowCount": 1}},
                                       "fields": "gridProperties.frozenRowCount"}} for t in write_tabs]})
        api("POST", f"{q}/values:batchUpdate", {"valueInputOption": "RAW",
            "data": [{"range": f"{t}!A1", "values": [hdr[t]]} for t in write_tabs]})
        print("headers written for:", write_tabs)
    url = f"{q}/values:batchGet?" + urllib.parse.urlencode([("ranges", f"{t}!1:1") for t in TABS])
    r = api("GET", url)
    ok = True
    for t, vr in zip(TABS, r["valueRanges"]):
        got = vr.get("values", [[]])[0]
        same = got == hdr[t]
        ok &= same
        print(f"{t}: {len(got)} cols", "MATCH sheet_schema.ts" if same else "MISMATCH")
    if not ok:
        raise SystemExit("header mismatch")
    tabs_now = list(ids)
    print("tabs now:", tabs_now)


def main():
    st = load_state()
    if "sa_email" not in st:
        raise SystemExit("run 01_gcp.py first")
    a = sys.argv[1:]
    owner = a[a.index("--owner") + 1] if "--owner" in a else ACCOUNT
    if "--sheet-only" not in a:
        try:
            calendar(st, owner)
        except ApiError as e:
            raise SystemExit(f"CALENDAR FAILED ({e.reason}): {e}")
        print("calendar_id:", st["calendar_id"])
    sid = None
    if "--sheet-id" in a:
        sid = a[a.index("--sheet-id") + 1]
    elif "--sheet-url" in a:
        m = re.search(r"/spreadsheets/d/([\w-]+)", a[a.index("--sheet-url") + 1])
        if not m:
            raise SystemExit("cannot parse sheet id from URL")
        sid = m.group(1)
    sid = sid or st.get("sheet_id")
    if "--calendar-only" in a or not sid:
        print("sheet step skipped (no --sheet-url/--sheet-id yet)")
        return
    st["sheet_id"] = sid
    st["sheet_url"] = f"https://docs.google.com/spreadsheets/d/{sid}/edit"
    save_state(st)
    try:
        sheet(st, sid, new_only="--new-tabs-only" in a)
    except ApiError as e:
        raise SystemExit(f"SHEET FAILED ({e.reason}): {e}\n-> is the sheet shared with {st['sa_email']} as Editor?")
    print("sheet:", sid, st["sheet_url"])


main()
