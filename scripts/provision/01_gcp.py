"""WP5 step 2: GCP project (no parent org), APIs, service account. Idempotent.
Run: PYTHONUTF8=1 python scripts/provision/01_gcp.py [--project <id>]"""
import random, sys
from _common import *

def main():
    st = load_state()
    pid = st.get("project_id")
    if "--project" in sys.argv:
        pid = sys.argv[sys.argv.index("--project") + 1]
    if not pid:
        pid = f"scg-voice-demo-{random.randint(100000, 999999)}"
    exists = gcloud("projects", "describe", pid, "--format=value(projectId)", check=False)
    if exists.returncode != 0:
        print(f"creating project {pid}")
        gcloud("projects", "create", pid, "--name=SCG Voice Demo", "--set-as-default")
    else:
        print(f"project {pid} exists")
    st["project_id"] = pid
    save_state(st)
    parent = gcloud("projects", "describe", pid, "--format=value(parent)").stdout.strip()
    print("parent:", repr(parent))
    if parent:
        raise SystemExit("ABORT: project has a parent org/folder")
    # serviceusage first
    gcloud("services", "enable", "serviceusage.googleapis.com", f"--project={pid}")
    r = gcloud("services", "enable", "iam.googleapis.com", *APIS, f"--project={pid}", check=False)
    if r.returncode != 0:
        print("API enable FAILED (billing?):", r.stderr.strip()[:500])
        raise SystemExit(2)
    en = gcloud("services", "list", "--enabled", f"--project={pid}", "--format=value(config.name)").stdout.split()
    for a in APIS:
        print(a, "enabled" if a in en else "MISSING")
    email = f"{SA_NAME}@{pid}.iam.gserviceaccount.com"
    d = gcloud("iam", "service-accounts", "describe", email, f"--project={pid}", check=False)
    if d.returncode != 0:
        gcloud("iam", "service-accounts", "create", SA_NAME, "--display-name=SCG voice worker", f"--project={pid}")
        print("SA created")
    else:
        print("SA exists")
    st["sa_email"] = email
    save_state(st)
    print("sa_email:", email)

main()
