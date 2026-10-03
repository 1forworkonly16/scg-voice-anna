// Copy lint for everything Anna says or the demo shows.
//   node scripts/copy-lint.mjs [file-or-dir ...]     (default: src/copy elevenlabs/prompt demo)
// Rules (plan L37, CLAUDE.md rule 4, brief C):
//   banned      «за полцены», «вдвойне сэкономить», «гарантированно дешевле управляющего», «управляющий завышает цены»,
//               LV «par pusi cenas», «divreiz ietaupīt» (+ «garantēti lētāk par pārvaldnieku»), RNP named as client / partner
//   price       a euro amount without «ориентировочно» / «orientējoši» in the same sentence
//   promise     SMS / e-mail promises («пришлём SMS», «отправим письмо», «nosūtīsim SMS», «e-pastu»)
//   placeholder «[уточнить]» in spoken text
// The ONLY exemptions: (a) a section under a heading that says Never / Запрещено / Нельзя (ends at the next heading of the
// same or higher level), (b) a line with a `copy-lint:ignore` marker, (c) lines between `copy-lint:off` and `copy-lint:on`.
// A `copy-lint:off` that is never closed is itself an ERROR (rule "marker"). A prohibition word on a spoken line exempts nothing.
// Exit code 1 when anything is found.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_TARGETS = ["src/copy", "elevenlabs/prompt", "demo"];
const TEXT_EXT = new Set([".md", ".txt", ".ts", ".js", ".mjs", ".json", ".yaml", ".yml", ".html"]);

export const BANNED = [
  { id: "za-polceny", re: /за\s+пол\s?цены/i },
  { id: "vdvoe-sekonomit", re: /вдвойне\s+сэкономить/i },
  { id: "garantirovanno-deshevle", re: /гарантированно\s+дешевле\s+управляющ/i },
  { id: "upravlyayuschiy-zavyshaet", re: /управляющ\S*\s+завышает\s+цен/i },
  { id: "lv-par-pusi-cenas", re: /par\s+pusi\s+cenas/i },
  { id: "lv-divreiz-ietaupit", re: /divreiz\s+ietaupīt/i },
  { id: "lv-garanteti-letak", re: /garantēti\s+lētāk\s+par\s+pārvaldnie/i },
  { id: "rnp-client", re: /(клиент|партн[её]р|заказчик)\S*\s+(?:[—-]\s+)?RNP|RNP\s+(?:[—-]\s+)?(?:наш\s+)?(клиент|партн[её]р|заказчик)|RNP\s+(?:ir\s+)?(?:mūsu\s+)?(klients|partneris)/i },
];

export const PROMISES = [
  { id: "ru-send-sms", re: /(пришл[её]м|пришлю|отправим|отправлю|вышлем|вышлю)\s+(вам\s+)?(sms|смс|письмо|сообщение|e-?mail|имейл)/i },
  { id: "ru-sms-come", re: /придёт\s+(sms|смс)|придет\s+(sms|смс)/i },
  { id: "lv-send-sms", re: /(nosūtīsim|nosūtīšu|atsūtīsim)\s+(jums\s+)?(sms|e-?pastu|īsziņu)/i },
  { id: "lv-epastu", re: /e-pastu/i },
];

const EURO_RE = /(?:\d[\d\s., ]*\s*(?:евро|€|eur\b|eiro)|€\s*\d|\{[a-z_]*(?:net|gross|apt)[a-z_]*\}\s*(?:евро|€|eur\b|eiro))/i;
const HEDGE_RE = /ориентировочн|orientējoši|orientējošs/i;
const NEVER_HEADING_RE = /^#{1,6}\s.*(never|запрещ|нельзя|never-list|nekad|aizliegt|запрет)/i;

function sentenceSpans(line) {
  // split on terminators; keep it simple: the unit of the "same sentence" rule
  return line.split(/(?<=[.!?…])\s+/);
}

/** Lint one text. Returns [{file, line, rule, id}] (no excerpts, to keep output short and safe). */
export function lintText(text, file = "<text>") {
  const out = [];
  const lines = text.split(/\r?\n/);
  let off = false;
  let offLine = 0;
  let skipLevel = 0; // heading level of a never-section currently being skipped (0 = none)
  const spoken = (n, rule, id) => out.push({ file, line: n + 1, rule, id });
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/copy-lint:off/i.test(line)) {
      off = true;
      offLine = i + 1;
    }
    if (/copy-lint:on/i.test(line)) {
      off = false;
      continue;
    }
    const h = /^(#{1,6})\s/.exec(line);
    if (h) {
      const level = h[1].length;
      if (skipLevel && level <= skipLevel) skipLevel = 0;
      if (!skipLevel && NEVER_HEADING_RE.test(line)) skipLevel = level;
    }
    if (off || skipLevel || /copy-lint:ignore/i.test(line)) continue;
    for (const b of BANNED) if (b.re.test(line)) spoken(i, "banned", b.id);
    for (const p of PROMISES) if (p.re.test(line)) spoken(i, "promise", p.id);
    if (/\[уточнить\]/i.test(line)) spoken(i, "placeholder", "utochnit");
    for (const s of sentenceSpans(line)) {
      if (EURO_RE.test(s) && !HEDGE_RE.test(s)) {
        // a hedge in the previous line's tail is not enough: the rule is per sentence
        spoken(i, "price", "euro-without-orientirovochno");
        break;
      }
    }
  }
  if (off) out.push({ file, line: offLine, rule: "marker", id: "copy-lint-off-never-closed" });
  return out;
}

function listFiles(target) {
  const abs = resolve(root, target);
  if (!existsSync(abs)) return [];
  const st = statSync(abs);
  if (st.isFile()) return [abs];
  const out = [];
  for (const name of readdirSync(abs)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    out.push(...listFiles(join(target, name)));
  }
  return out;
}

export function lintFiles(targets) {
  const hits = [];
  let scanned = 0;
  for (const t of targets) {
    for (const f of listFiles(t)) {
      if (!TEXT_EXT.has(extname(f).toLowerCase())) continue;
      scanned++;
      hits.push(...lintText(readFileSync(f, "utf8"), f.replace(root, "").replace(/^[\\/]/, "")));
    }
  }
  return { hits, scanned };
}

function main() {
  const args = process.argv.slice(2);
  const { hits, scanned } = lintFiles(args.length ? args : DEFAULT_TARGETS);
  for (const h of hits) console.error(`${h.file}:${h.line}: [${h.rule}] ${h.id}`);
  console.log(`copy-lint: ${scanned} file(s) scanned, ${hits.length} problem(s)`);
  process.exit(hits.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
