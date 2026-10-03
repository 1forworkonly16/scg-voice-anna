"""WP5 step 3: exactly ONE SA key -> Windows USER env var GOOGLE_SA_KEY_JSON (never a file, never printed).
Run: PYTHONUTF8=1 python scripts/provision/02_sa_key.py"""
import json
from _common import *

def list_keys(pid, email):
    out = gcloud("iam", "service-accounts", "keys", "list", f"--iam-account={email}", f"--project={pid}",
                 "--managed-by=user", "--format=value(name)").stdout.split()
    return [n.rsplit("/", 1)[-1] for n in out]

def main():
    st = load_state()
    pid, email = st["project_id"], st["sa_email"]
    keys = list_keys(pid, email)
    cur = get_user_env("GOOGLE_SA_KEY_JSON")
    if cur:
        try:
            j = json.loads(cur)
            if j.get("client_email") == email and j.get("private_key_id") in keys and len(keys) == 1:
                print("key already provisioned; client_email:", j["client_email"], "| user keys:", len(keys))
                return
        except Exception:
            pass
    # orphans / stale keys: delete all user-managed keys, then create one
    for kid in keys:
        gcloud("iam", "service-accounts", "keys", "delete", kid, f"--iam-account={email}", f"--project={pid}", "--quiet")
        print("deleted stale key", kid[:8] + "...")
    p = gcloud("iam", "service-accounts", "keys", "create", "-", f"--iam-account={email}", f"--project={pid}",
               "--key-file-type=json", check=False)
    try:
        j = json.loads(p.stdout)
        assert j["client_email"] == email and j["private_key"]
    except Exception:
        for kid in list_keys(pid, email):
            gcloud("iam", "service-accounts", "keys", "delete", kid, f"--iam-account={email}", f"--project={pid}", "--quiet")
        raise SystemExit("key creation/parse failed; orphan key(s) deleted")
    set_user_env("GOOGLE_SA_KEY_JSON", json.dumps(j, separators=(",", ":")))
    back = json.loads(get_user_env("GOOGLE_SA_KEY_JSON"))
    assert back["private_key_id"] == j["private_key_id"]
    print("stored in user env; client_email:", back["client_email"], "| user keys:", len(list_keys(pid, email)))

main()
