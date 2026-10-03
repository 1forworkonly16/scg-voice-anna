// Sets every Worker secret through `wrangler secret put` with the value on STDIN (never on a command line, never printed).
//   powershell -NoProfile -ExecutionPolicy Bypass -Command ". .\scripts\env.ps1; node scripts\secrets.mjs [--missing-only] [--dry]"
// Sources (process env, filled by scripts/env.ps1):
//   GOOGLE_SA_KEY_JSON, TELEGRAM_BOT_TOKEN : read from the env (provisioned earlier by WP5 / the user).
//   SCG_TOOL_KEY, SCG_ADMIN_KEY            : generated here ONLY IF ABSENT (32 random bytes, base64url) and persisted to the
//                                            Windows USER env (HKCU\Environment) so WP8 can configure the agent's tool header.
//   ELEVENLABS_WEBHOOK_SECRET              : ElevenLabs ISSUES this value when the workspace webhook is created (WP8), so it is NOT
//                                            generated here. It is pushed only if it is already present in the env (re-run after WP8).
// Output: names and set / present / skipped only. Idempotent: re-running keeps existing keys and re-puts the same values.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = resolve(root, "node_modules", "wrangler", "bin", "wrangler.js");
const args = new Set(process.argv.slice(2));
const dry = args.has("--dry");
const missingOnly = args.has("--missing-only");

const READ_FROM_ENV = ["GOOGLE_SA_KEY_JSON", "TELEGRAM_BOT_TOKEN"];
const GENERATE_IF_ABSENT = ["SCG_TOOL_KEY", "SCG_ADMIN_KEY"];
const DEFERRED_TO_WP8 = ["ELEVENLABS_WEBHOOK_SECRET"];

const clean = (v) => (v ?? "").trim();

/** Persist to the Windows USER environment; the value travels in the child's environment, not on any command line. */
function persistUserEnv(name, value) {
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", `[Environment]::SetEnvironmentVariable('${name}', $env:SCG_PERSIST_VALUE, 'User')`],
    { env: { ...process.env, SCG_PERSIST_VALUE: value }, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`could not persist ${name} to the user environment`);
}

/** Names of the secrets already on the Worker (wrangler prints a JSON array of {name,type}). */
function existingSecrets() {
  const r = spawnSync(process.execPath, [wrangler, "secret", "list", "--format", "json"], { cwd: root, env: process.env, encoding: "utf8" });
  if (r.status !== 0) return null;
  try {
    return new Set(JSON.parse(r.stdout).map((s) => s.name));
  } catch {
    return null;
  }
}

function putSecret(name, value) {
  const r = spawnSync(process.execPath, [wrangler, "secret", "put", name], { cwd: root, env: process.env, input: value, encoding: "utf8" });
  if (r.status !== 0) {
    const why = (r.stderr || r.stdout || "").split(/\r?\n/).filter((l) => l.trim()).slice(-2).join(" | ").replaceAll(value, "***").slice(0, 300);
    throw new Error(`wrangler secret put ${name} failed: ${why}`);
  }
}

const have = missingOnly ? existingSecrets() : null;
const report = [];
let failed = false;

for (const name of GENERATE_IF_ABSENT) {
  if (!clean(process.env[name])) {
    const v = randomBytes(32).toString("base64url");
    if (!dry) persistUserEnv(name, v);
    process.env[name] = v;
    report.push(`${name}: generated${dry ? " (dry: not persisted)" : " and persisted to user env"}`);
  } else {
    report.push(`${name}: present in env (kept)`);
  }
}

for (const name of [...READ_FROM_ENV, ...GENERATE_IF_ABSENT, ...DEFERRED_TO_WP8]) {
  const v = clean(process.env[name]);
  if (!v) {
    report.push(`${name}: ${DEFERRED_TO_WP8.includes(name) ? "deferred to WP8 (ElevenLabs issues it; re-run after the workspace webhook exists)" : "MISSING in env"}`);
    if (!DEFERRED_TO_WP8.includes(name)) failed = true;
    continue;
  }
  if (have?.has(name)) {
    report.push(`${name}: already on the Worker (skipped)`);
    continue;
  }
  if (dry) {
    report.push(`${name}: would set (dry)`);
    continue;
  }
  try {
    putSecret(name, v);
    report.push(`${name}: set on the Worker`);
  } catch (e) {
    failed = true;
    report.push(`${name}: FAILED ${e instanceof Error ? e.message : "error"}`);
  }
}

console.log(report.join("\n"));
process.exit(failed ? 1 : 0);
