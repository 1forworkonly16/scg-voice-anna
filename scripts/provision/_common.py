"""Shared helpers for WP5 provisioning. Never prints secrets."""
import json, os, shutil, subprocess, sys
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
STATE = HERE / "state.json"          # IDs only, no secrets
GCLOUD = shutil.which("gcloud.cmd") or shutil.which("gcloud")
GWS = shutil.which("gws.cmd") or shutil.which("gws")
ACCOUNT = "1forworkonly16@gmail.com"
SA_NAME = "scg-voice-worker"
APIS = ["calendar-json.googleapis.com", "sheets.googleapis.com", "drive.googleapis.com"]


def load_state():
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}


def save_state(d):
    STATE.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def run(cmd, input_text=None, check=True):
    p = subprocess.run(cmd, input=input_text, capture_output=True, text=True, encoding="utf-8")
    if check and p.returncode != 0:
        raise SystemExit(f"FAILED: {Path(cmd[0]).name} {' '.join(cmd[1:4])} ...\n{p.stderr.strip()[:600]}")
    return p


def gcloud(*args, check=True):
    return run([GCLOUD, *args], check=check)


def get_user_env(name):
    import winreg
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as k:
        try:
            return winreg.QueryValueEx(k, name)[0]
        except FileNotFoundError:
            return None


def set_user_env(name, value):
    import winreg, ctypes
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment", 0, winreg.KEY_SET_VALUE) as k:
        winreg.SetValueEx(k, name, 0, winreg.REG_SZ, value)
    res = ctypes.c_ulong()
    ctypes.windll.user32.SendMessageTimeoutW(0xFFFF, 0x001A, 0, "Environment", 2, 5000, ctypes.byref(res))
