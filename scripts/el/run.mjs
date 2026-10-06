// Cross-platform runner behind the npm scripts el:* and link:*. Never prints env values.
//   node scripts/el/run.mjs <script.ts> [args]
// Windows: runs the PowerShell wrapper scripts/el/run.ps1 (loads the user env, names only), exactly as before.
// Elsewhere (cloud session): runs node on the script directly; the secrets come from the environment settings.
// Exits with the child's exit code.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error("usage: node scripts/el/run.mjs <script.ts> [args]");
  process.exit(2);
}

const r =
  process.platform === "win32"
    ? spawnSync(
        "powershell",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolve(dirname(fileURLToPath(import.meta.url)), "run.ps1"), script, ...args],
        { stdio: "inherit" },
      )
    : spawnSync(process.execPath, [script, ...args], {
        stdio: "inherit",
        env: { ...process.env, PYTHONUTF8: "1", WRANGLER_SEND_METRICS: "false" },
      });

if (r.error) {
  console.error(`run.mjs: could not start the child process: ${r.error.message}`);
  process.exit(1);
}
if (r.status === null) console.error(`run.mjs: the child process ended on signal ${r.signal}`);
process.exit(r.status ?? 1);
