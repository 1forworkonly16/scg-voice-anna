"""WP5 step 6: find Telegram group + private chat ids via getUpdates, verify getChat. Sends ONE test message per chat the first time (message ids recorded; re-runs do not resend).
Token is read from env (never printed).
Run via env.ps1 loader (see docs/resources.md)
"""
import json, os, urllib.parse, urllib.request
from _common import *

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") or get_user_env("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    raise SystemExit("TELEGRAM_BOT_TOKEN missing (load via env.ps1)")

def api(method, **params):
    q = "&".join(f"{k}={v}" for k, v in params.items())
    with urllib.request.urlopen(f"https://api.telegram.org/bot{TOKEN.strip()}/{method}?{q}", timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))

def main():
    st = load_state()
    ups = api("getUpdates", limit=100, timeout=0)["result"]
    groups, privates = {}, {}
    def note(chat):
        if not chat: return
        if chat["type"] in ("group", "supergroup"):
            groups[chat["id"]] = chat.get("title")
        elif chat["type"] == "private":
            privates[chat["id"]] = chat.get("username") or chat.get("first_name")
    for u in ups:
        for key in ("message", "my_chat_member", "edited_message", "channel_post", "chat_member"):
            if key in u:
                note(u[key].get("chat"))
    want = "SCG — Заявки (демо)"
    gid = st.get("tg_group_id")
    cands = [i for i, t in groups.items() if t == want] or [i for i, t in groups.items() if "заявки" in (t or "").lower()]
    if cands:
        gid = max(cands, key=lambda i: (str(i).startswith("-100"), i))  # prefer supergroup id (-100…)
    cid = st.get("tg_test_chat_id") or next(iter(privates), None)
    print("groups seen:", {i: t for i, t in groups.items()})
    print("private chats seen:", len(privates))
    if not gid or not cid:
        raise SystemExit("group or private chat id not found in getUpdates (updates may have been consumed)")
    for label, i in (("group", gid), ("test chat", cid)):
        r = api("getChat", chat_id=i)
        assert r["ok"], r
        print(f"getChat {label}: ok id={i} type={r['result']['type']} title/name={r['result'].get('title') or r['result'].get('first_name')}")
    st["tg_group_id"], st["tg_test_chat_id"] = gid, cid
    save_state(st)
    sent = st.setdefault("tg_test_messages", {})
    for label, i in (("group", gid), ("test_chat", cid)):
        if label in sent:
            print(f"test message to {label}: already sent (message_id={sent[label]})")
            continue
        text = urllib.parse.quote("Проверка связи: канал уведомлений ИИ-ассистента Анна подключён. ДЕМО · WP5")
        r = api("sendMessage", chat_id=i, text=text)
        assert r["ok"], r
        sent[label] = r["result"]["message_id"]
        print(f"test message to {label}: sent message_id={sent[label]}")
        save_state(st)

main()
