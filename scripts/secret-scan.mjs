// Secret scan.  node scripts/secret-scan.mjs
// 1. Key patterns in git-tracked + untracked-not-ignored files: sk_ / sk- keys, xi-api-key values, PEM private keys,
//    Telegram bot tokens, Google API keys (AIza...), long hex strings next to words like secret / token / key.
// 2. Exact-value scan: the env vars named in docs/setup_keys.md are read from the Windows USER scope via
//    powershell [Environment]::GetEnvironmentVariable and searched for byte-for-byte in the same files.
// Output carries names, file and line only, NEVER a value or an excerpt. Exit 1 when anything is found.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".mp3", ".wav", ".ogg", ".woff", ".woff2", ".zip", ".gz", ".lock"]);
const SKIP_NAMES = new Set(["package-lock.json", "parity.json", "info_manifest.sha256"]);
const MAX_BYTES = 2 * 1024 * 1024;

export const PATTERNS = [
  { id: "sk-key", re: /\bsk[_-](?:ant-|live_|test_|proj-)?[A-Za-z0-9_-]{20,}/ },
  { id: "xi-api-key-value", re: /xi-api-key["']?\s*[:=]\s*["']?(?!\$|<|\{|process\.|env)[A-Za-z0-9_-]{16,}/i },
  { id: "private-key-pem", re: /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/ },
  { id: "telegram-bot-token", re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "long-hex-secret", re: /(?:secret|token|passw(?:or)?d|api[_-]?key|auth)[\w"' ]{0,24}[:=]\s*["']?[a-f0-9]{32,}\b/i },
];

/** Pattern hits in one text: [{line, id}] (no excerpts). */
export function scanText(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const p of PATTERNS) if (p.re.test(lines[i])) out.push({ line: i + 1, id: p.id });
  }
  return out;
}

/** Exact-value hits: [{line, name}] for candidates = [{name, values: string[]}]. */
export function scanExact(text, candidates) {
  const out = [];
  const lines = text.split(/\r?\n/);
  for (const c of candidates) {
    for (const v of c.values) {
      if (!v || v.length < 8) continue;
      if (!text.includes(v)) continue;
      for (let i = 0; i < lines.length; i++) if (lines[i].includes(v)) out.push({ line: i + 1, name: c.name });
      // a multi-line value can only be found on the whole text
      if (!lines.some((l) => l.includes(v))) out.push({ line: 0, name: c.name });
    }
  }
  return out;
}

/** Env var names from the table in docs/setup_keys.md (first column, backticked UPPER_SNAKE names). */
export function envNamesFromSetupDoc(md) {
  const names = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /^\|\s*`([A-Z][A-Z0-9_]+)`\s*\|/.exec(line);
    if (m && !names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

function userEnv(name) {
  try {
    const out = execFileSync("powershell", ["-NoProfile", "-Command", `[Environment]::GetEnvironmentVariable('${name}','User')`], { encoding: "utf8", windowsHide: true, timeout: 20000 });
    return out.replace(/\r?\n$/, "");
  } catch {
    return "";
  }
}

/** Values to look for: the raw value, plus the private key material when the value is a service-account JSON. */
export function candidateValues(raw) {
  const values = [raw.trim()];
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === "object") {
      for (const k of ["private_key", "private_key_id", "client_secret"]) {
        if (typeof j[k] === "string" && j[k].length >= 16) {
          values.push(j[k], JSON.stringify(j[k]).slice(1, -1));
          const body = j[k].replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
          if (body.length > 40) values.push(body.slice(0, 40));
        }
      }
    }
  } catch {
    /* not JSON */
  }
  return [...new Set(values.filter(Boolean))];
}

function gitFiles() {
  const run = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n").filter(Boolean);
  const files = new Set([...run(["ls-files"]), ...run(["ls-files", "--others", "--exclude-standard"])]);
  return [...files];
}

function main() {
  const files = gitFiles().filter((f) => !SKIP_EXT.has(extname(f).toLowerCase()) && !SKIP_NAMES.has(f.split("/").pop()));
  const docPath = resolve(root, "docs", "setup_keys.md");
  const names = existsSync(docPath) ? envNamesFromSetupDoc(readFileSync(docPath, "utf8")) : [];
  const candidates = [];
  const empty = [];
  for (const n of names) {
    const v = userEnv(n);
    if (v) candidates.push({ name: n, values: candidateValues(v) });
    else empty.push(n);
  }
  console.log(`secret-scan: ${files.length} file(s); env vars checked (names only): ${candidates.map((c) => c.name).join(", ") || "none"}; empty/skipped: ${empty.join(", ") || "none"}`);

  let problems = 0;
  for (const f of files) {
    const abs = resolve(root, f);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (!st.isFile() || st.size > MAX_BYTES) continue;
    let text;
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    for (const h of scanText(text)) {
      console.error(`${f}:${h.line}: pattern ${h.id}`);
      problems++;
    }
    for (const h of scanExact(text, candidates)) {
      console.error(`${f}:${h.line}: exact value of env var ${h.name}`);
      problems++;
    }
  }
  console.log(`secret-scan: ${problems} problem(s)`);
  process.exit(problems ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
