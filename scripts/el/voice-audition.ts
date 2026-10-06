// Voice audition for Anna: renders fixed Russian lines with candidate voices x models x stabilities, so the user picks a
// Russian-native voice by ear. Node 22+ native TS, no deps. Never prints the API key. Never retries a POST (it costs credits).
//
//   node scripts/el/voice-audition.ts [--dry]       DEFAULT: print the matrix, the characters and a credit estimate. ZERO API calls, no key.
//   node scripts/el/voice-audition.ts --run         render the mp3 files (needs ELEVENLABS_API_KEY)
//   npm run el:audition -- --dry | --run [options]
//
// Options (--flag value or --flag=value; lists as a,b or a b; in PowerShell quote a list: --voices 'id1,id2'):
//   --max-chars N        default 3000. --run refuses a matrix above N characters BEFORE any API call (a --library N counts N more voices)
//   --library N          add the top N voices of GET /v1/shared-voices?language=ru&gender=female&category=professional (needs --run to resolve)
//   --voices id1,id2     replace the default candidates (Elena Gromova, Marusya G, Anna ET = control, the current voice)
//   --models m1,m2       default eleven_v4_turbo,eleven_flash_v2_5
//   --stability s1,s2    default 0.5,0.65 (similarity_boost 0.75 and speed 1.0 are fixed)
//   --lines k1,k2|all    keys of scripts/el/audition_lines.json; default = the lines flagged "default" there (greeting, ack, building_latin)
//
// Cost: text-to-speech is billed per character. Credit ESTIMATE = characters x 1.0, but x 0.5 for eleven_v4_turbo and
//   eleven_flash_v2_5. It is an estimate: check `npm run el:credits` before and after (the balance lags about 1 minute).
//   Default matrix: 3 voices x 2 models x 2 stabilities x 3 short lines = 2,268 characters = ~1,134 credits. Do a second, targeted
//   round for the shortlist with --voices id1,id2 --lines price,slots (long lines are the expensive ones).
// Output: .tmp/audition/<nn>_<voice>_<model>_s<stability>_<line>.mp3 and .tmp/audition/index.html (open it in a browser, grouped by
//   candidate). .tmp/ is git-ignored. Nothing else is written; no secret is stored.
// A library voice that is not in the account yet is reported and skipped. This script never adds a voice: that changes the account.
//   Add the one you like in the ElevenLabs web app (My Voices) and run it again with --voices <voice_id>. public_owner_id is recorded.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BASE, el } from './api.ts';
import { p, readJson } from './common.ts';

const DEFAULT_MODELS = ['eleven_v4_turbo', 'eleven_flash_v2_5'];
const DEFAULT_STABS = [0.5, 0.65];
const DEFAULT_MAX_CHARS = 3000;
const HALF_PRICE_MODELS = new Set(['eleven_v4_turbo', 'eleven_flash_v2_5']);
const SIMILARITY_BOOST = 0.75;
const SPEED = 1.0;
const OUTPUT_FORMAT = 'mp3_44100_128';
const MAX_CONSECUTIVE_FAILURES = 3;
const LIST_FLAGS = ['--voices', '--models', '--stability', '--lines'];

interface Voice { id: string; name: string; control?: boolean; owner?: string; library?: boolean }
interface Line { key: string; label: string; text: string; isDefault: boolean }
interface Combo { n: number; voice: Voice; model: string; stab: number; line: Line; chars: number; credits: number }
interface Opts { run: boolean; help: boolean; maxChars: number; library: number; voices: string[] | null; models: string[]; stabs: number[]; lines: string[] | null }

const CANDIDATES: Voice[] = [
  { id: '0ArNnoIAWKlT4WweaVMY', name: 'Elena Gromova' },
  { id: 'sNQyZH8Wfcnv7zh3rHxR', name: 'Marusya G' },
  { id: '2wP8BdKwYp0tZqqoNvMa', name: 'Anna ET', control: true },
];

const creditMult = (model: string): number => (HALF_PRICE_MODELS.has(model) ? 0.5 : 1);
const nChars = (s: string): number => [...s].length;
const num = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
const slug = (s: string): string => s.normalize('NFKD').replace(/[^\x00-\x7F]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------------------------------------------------------------------
// arguments

const USAGE = (() => { // the leading comment block of this file
  const head: string[] = [];
  for (const l of readFileSync(new URL(import.meta.url), 'utf8').split('\n')) { if (!l.startsWith('//')) break; head.push(l.slice(3)); }
  return head.join('\n');
})();

function parseArgs(argv: string[]): Opts {
  const o: Opts = { run: false, help: false, maxChars: DEFAULT_MAX_CHARS, library: 0, voices: null, models: DEFAULT_MODELS, stabs: DEFAULT_STABS, lines: null };
  let dry = false;
  const list = (v: string, flag: string): string[] => { // commas or spaces: PowerShell may turn an unquoted a,b into «a b»
    const xs = [...new Set(v.split(/[,\s]+/).filter(Boolean))];
    if (!xs.length) throw new Error(`${flag} needs a comma-separated list`);
    return xs;
  };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i] ?? '', val: string | undefined;
    const eq = a.indexOf('=');
    if (a.startsWith('--') && eq > 0) { val = a.slice(eq + 1); a = a.slice(0, eq); }
    if (a === '--dry') { dry = true; continue; }
    if (a === '--run') { o.run = true; continue; }
    if (a === '--help' || a === '-h') { o.help = true; continue; }
    if (!['--max-chars', '--library', '--voices', '--models', '--stability', '--lines'].includes(a)) throw new Error(`unknown option ${a}`);
    if (val === undefined) {
      val = argv[++i];
      if (val === undefined || val.startsWith('--')) throw new Error(`${a} needs a value`);
      if (LIST_FLAGS.includes(a)) for (let nx = argv[i + 1]; nx !== undefined && !nx.startsWith('--'); nx = argv[i + 1]) { val += `,${nx}`; i++; } // --voices id1 id2
    }
    if (a === '--max-chars') { if (!/^\d+$/.test(val) || Number(val) < 1) throw new Error('--max-chars must be a positive integer'); o.maxChars = Number(val); }
    else if (a === '--library') { if (!/^\d+$/.test(val) || Number(val) < 1 || Number(val) > 100) throw new Error('--library must be an integer from 1 to 100'); o.library = Number(val); }
    else if (a === '--voices') {
      o.voices = list(val, a);
      const bad = o.voices.filter((v) => !/^[A-Za-z0-9_-]{8,64}$/.test(v));
      if (bad.length) throw new Error(`--voices: not a voice id: ${bad.join(', ')}`);
    } else if (a === '--models') {
      o.models = list(val, a);
      const bad = o.models.filter((m) => !/^[A-Za-z0-9_.-]+$/.test(m));
      if (bad.length) throw new Error(`--models: not a model id: ${bad.join(', ')}`);
    } else if (a === '--stability') {
      o.stabs = list(val, a).map(Number);
      if (o.stabs.some((s) => !Number.isFinite(s) || s < 0 || s > 1)) throw new Error('--stability values must be numbers from 0 to 1');
      o.stabs = [...new Set(o.stabs)];
    } else o.lines = list(val, a);
  }
  if (dry && o.run) throw new Error('use either --dry or --run, not both');
  return o;
}

// ---------------------------------------------------------------------------------------------------------------------------
// lines and matrix

function loadLines(selection: string[] | null): { chosen: Line[]; all: Line[] } {
  const raw = readJson(p('scripts', 'el', 'audition_lines.json'));
  const all: Line[] = (raw.lines ?? []).map((l: { key?: string; label?: string; text?: string; source?: string; default?: boolean }) => {
    const text = l.source ? readFileSync(p(l.source), 'utf8').trim() : String(l.text ?? '').trim(); // the greeting is read at run time
    if (!l.key || !text) throw new Error(`audition_lines.json: line "${l.key ?? '?'}" has no text`);
    return { key: l.key, label: l.label ?? l.key, text, isDefault: l.default === true };
  });
  if (new Set(all.map((l) => l.key)).size !== all.length) throw new Error('audition_lines.json: duplicate line keys');
  if (selection === null) { const d = all.filter((l) => l.isDefault); return { chosen: d.length ? d : all, all }; }
  if (selection.length === 1 && selection[0] === 'all') return { chosen: all, all };
  const unknown = selection.filter((k) => !all.some((l) => l.key === k));
  if (unknown.length) throw new Error(`--lines: unknown key ${unknown.join(', ')} (valid: ${all.map((l) => l.key).join(', ')}, all)`);
  return { chosen: all.filter((l) => selection.includes(l.key)), all };
}

function baseVoices(ids: string[] | null): Voice[] {
  if (!ids) return CANDIDATES.map((v) => ({ ...v }));
  return ids.map((id) => ({ ...(CANDIDATES.find((c) => c.id === id) ?? { id, name: `voice ${id.slice(0, 6)}` }) }));
}

function buildMatrix(voices: Voice[], models: string[], stabs: number[], lines: Line[]): Combo[] {
  const out: Combo[] = [];
  for (const voice of voices) for (const model of models) for (const stab of stabs) for (const line of lines) {
    const chars = nChars(line.text);
    out.push({ n: out.length + 1, voice, model, stab, line, chars, credits: chars * creditMult(model) });
  }
  return out;
}

const perVoiceChars = (models: string[], stabs: number[], lines: Line[]): number => models.length * stabs.length * lines.reduce((s, l) => s + nChars(l.text), 0);
const perVoiceCredits = (models: string[], stabs: number[], lines: Line[]): number => models.reduce((s, m) => s + creditMult(m), 0) * stabs.length * lines.reduce((s, l) => s + nChars(l.text), 0);

// ---------------------------------------------------------------------------------------------------------------------------
// dry run: zero API calls

function dry(o: Opts, voices: Voice[], lines: Line[], all: Line[]): number {
  const nVoices = voices.length + o.library;
  const chars = perVoiceChars(o.models, o.stabs, lines) * nVoices;
  const credits = perVoiceCredits(o.models, o.stabs, lines) * nVoices;
  console.log('voice-audition DRY RUN: no API calls, no key needed (add --run to render)\n');
  console.log(`candidates (${voices.length}${o.library ? ` + ${o.library} from the library` : ''}):`);
  voices.forEach((v, i) => console.log(`  ${i + 1}  ${v.name.padEnd(16)} ${v.id}${v.control ? '  (control: the current voice)' : ''}`));
  if (o.library) console.log(`  +  ${o.library} voice(s) of GET /v1/shared-voices?language=ru&gender=female&category=professional, resolved at --run (counted below as ${o.library} more candidates)`);
  console.log(`models: ${o.models.map((m) => `${m} (x${creditMult(m)})`).join(', ')}`);
  console.log(`stabilities: ${o.stabs.join(', ')} | similarity_boost ${SIMILARITY_BOOST}, speed ${SPEED.toFixed(1)}, ${OUTPUT_FORMAT}`);
  console.log(`lines (${lines.length} of ${all.length}): ${lines.map((l) => `${l.key} ${nChars(l.text)}`).join(', ')}  = ${num(lines.reduce((s, l) => s + nChars(l.text), 0))} chars per voice/model/stability`);
  const rest = all.filter((l) => !lines.includes(l));
  if (rest.length) console.log(`not selected: ${rest.map((l) => `${l.key} ${nChars(l.text)}`).join(', ')} (--lines k1,k2 or --lines all)`);
  const m = buildMatrix(voices, o.models, o.stabs, lines);
  console.log(`\nmatrix: ${voices.length}${o.library ? ` (+${o.library})` : ''} voices x ${o.models.length} models x ${o.stabs.length} stabilities x ${lines.length} lines = ${m.length}${o.library ? ` (+${o.library * o.models.length * o.stabs.length * lines.length})` : ''} render${m.length === 1 && !o.library ? '' : 's'}`);
  const w = Math.max(5, ...m.map((c) => c.voice.name.length)), wm = Math.max(5, ...m.map((c) => c.model.length)), wl = Math.max(4, ...m.map((c) => c.line.key.length));
  console.log(`  ${'nn'.padEnd(3)} ${'voice'.padEnd(w)}  ${'model'.padEnd(wm)}  stab   ${'line'.padEnd(wl)}  chars  credits~`);
  const nn = Math.max(2, String(m.length).length);
  for (const c of m) console.log(`  ${String(c.n).padStart(nn, '0').padEnd(3)} ${c.voice.name.padEnd(w)}  ${c.model.padEnd(wm)}  ${String(c.stab).padEnd(5)}  ${c.line.key.padEnd(wl)}  ${String(c.chars).padStart(5)}  ${String(num(c.credits)).padStart(7)}`);
  const renders = nVoices * o.models.length * o.stabs.length * lines.length;
  console.log(`\ntotal: ${num(chars)} characters in ${num(renders)} render${renders === 1 ? '' : 's'}`);
  console.log(`credit estimate: ~${num(credits)} credits (estimate; check el:credits before/after)`);
  console.log(chars <= o.maxChars
    ? `--max-chars ${num(o.maxChars)}: OK (${num(chars)} <= ${num(o.maxChars)})`
    : `--max-chars ${num(o.maxChars)}: --run WOULD REFUSE (${num(chars)} > ${num(o.maxChars)}); trim --lines/--models/--stability/--voices or raise --max-chars knowingly`);
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------------------
// --run: text-to-speech

type TtsResult =
  | { ok: true; audio: Buffer; cost: number | null }
  | { ok: false; status: number; message: string; needsAdd: boolean; fatal: boolean };

/** One POST, never retried: a failed or timed-out request may still have cost credits. Does not touch the key except in the header. */
async function tts(key: string, voiceId: string, model: string, stab: number, text: string): Promise<TtsResult> {
  let r: Response;
  try {
    r = await fetch(`${BASE}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability: stab, similarity_boost: SIMILARITY_BOOST, speed: SPEED } }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    return { ok: false, status: 0, message: `network error or timeout (${errMsg(e)}); not retried, it may still have been charged`, needsAdd: false, fatal: false };
  }
  if (r.ok) {
    const audio = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') ?? '';
    if (audio.length < 100 || !/audio|octet-stream/i.test(ct)) return { ok: false, status: r.status, message: `unexpected 200 response (${ct || 'no content-type'}, ${audio.length} bytes)`, needsAdd: false, fatal: false };
    const h = r.headers.get('character-cost'); // credits charged, when ElevenLabs sends the header
    return { ok: true, audio, cost: h !== null && Number.isFinite(Number(h)) ? Number(h) : null };
  }
  const raw = (await r.text().catch(() => '')).slice(0, 700);
  let detail: unknown = null;
  try { detail = (JSON.parse(raw) as { detail?: unknown }).detail; } catch { /* not JSON */ }
  const d = detail as { message?: string; status?: string } | string | null;
  const message = `${r.status} ${typeof d === 'string' ? d : (d?.message ?? d?.status ?? raw.slice(0, 200))}`.trim();
  const needsAdd = [400, 402, 403, 404, 422].includes(r.status) && /voice_not_found|voice_does_not_exist|not.{0,30}found|librar|my voices|add.{0,30}voice/i.test(raw);
  return { ok: false, status: r.status, message, needsAdd, fatal: !needsAdd && (r.status === 401 || r.status === 402) };
}

interface Rendered { combo: Combo; file: string }

function indexHtml(voices: Voice[], rendered: Rendered[], skipped: Map<string, string>, meta: { chars: number; when: string }): string {
  const rows = (v: Voice): string => rendered.filter((r) => r.combo.voice.id === v.id).map((r) => `<tr><td>${esc(r.combo.model)}</td><td>${r.combo.stab}</td>`
    + `<td>${esc(r.combo.line.label)}<span class="t">${esc(r.combo.line.text)}</span></td><td><audio controls preload="none" src="${encodeURIComponent(r.file)}"></audio></td></tr>`).join('\n');
  const shown = voices.filter((v) => rendered.some((r) => r.combo.voice.id === v.id) || skipped.has(v.id));
  const sections = shown.map((v, i) => {
    const note = skipped.get(v.id);
    return `<section id="v${i + 1}"><h2>${esc(v.name)}${v.control ? ' <small>(контроль: текущий голос Анны)</small>' : ''}</h2>\n`
      + `<p class="meta">voice_id <code>${esc(v.id)}</code>${v.owner ? `, public_owner_id <code>${esc(v.owner)}</code> (голос из библиотеки)` : ''}</p>\n`
      + (note ? `<p class="warn">Не отрисован: голос недоступен в этом аккаунте (ответ API: ${esc(note)}). Если это голос из библиотеки, сначала добавьте его в аккаунт в веб-приложении ElevenLabs (My Voices) и запустите скрипт снова с --voices ${esc(v.id)}. Скрипт голоса сам не добавляет.</p>\n` : `<div class="tbl"><table><thead><tr><th>Модель</th><th>Стабильность</th><th>Фраза</th><th>Прослушать</th></tr></thead>\n<tbody>\n${rows(v)}\n</tbody></table></div>\n`)
      + '</section>';
  });
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Прослушивание голосов Анны</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0 auto; max-width: 960px; padding: 16px; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.15rem; margin: 2rem 0 .1rem; }
  nav a { margin-right: 1rem; }
  .meta { color: GrayText; font-size: .85rem; margin: 0 0 .5rem; }
  .warn { border-left: 4px solid currentColor; padding: .25rem .75rem; }
  .tbl { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent); vertical-align: middle; }
  audio { width: 100%; min-width: 240px; }
  .t { display: block; color: GrayText; font-size: .8rem; }
</style>
</head>
<body>
<h1>Прослушивание голосов Анны</h1>
<p class="meta">Создано ${esc(meta.when)}. Файлов: ${rendered.length}, символов: ${meta.chars}. Папка .tmp/ не попадает в git.</p>
<nav>${shown.map((v, i) => `<a href="#v${i + 1}">${esc(v.name)}</a>`).join('')}</nav>
${sections.join('\n')}
</body>
</html>
`;
}

async function run(o: Opts, voices: Voice[], lines: Line[]): Promise<number> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { console.error('ELEVENLABS_API_KEY missing (dot-source scripts/env.ps1, or set it in the environment settings)'); return 1; }

  // budget check BEFORE any API call; a --library N is counted at its maximum (N more voices)
  const worst = perVoiceChars(o.models, o.stabs, lines) * (voices.length + o.library);
  if (worst > o.maxChars) {
    console.error(`refusing to run: ${num(worst)} characters (${voices.length + o.library} voices x ${o.models.length} models x ${o.stabs.length} stabilities x ${lines.length} lines) > --max-chars ${num(o.maxChars)}. No API call was made.`);
    console.error('Trim the matrix (--lines, --models, --stability, --voices, --library) or raise --max-chars knowingly. `--dry` shows the matrix.');
    return 2;
  }

  if (o.library) {
    try {
      const j = await el('GET', `/v1/shared-voices?page_size=${o.library}&language=ru&gender=female&category=professional`);
      let added = 0;
      for (const v of ((j?.voices ?? []) as Array<{ voice_id?: string; name?: string; public_owner_id?: string }>).slice(0, o.library)) {
        const id = String(v.voice_id ?? '');
        if (!id) continue;
        const owner = v.public_owner_id ? String(v.public_owner_id) : undefined;
        const known = voices.find((x) => x.id === id);
        if (known) { known.owner ??= owner; continue; }
        voices.push({ id, name: String(v.name ?? `voice ${id.slice(0, 6)}`), owner, library: true });
        added++;
      }
      console.log(`library: ${added} new voice(s) from GET /v1/shared-voices (public_owner_id recorded)`);
    } catch (e) {
      console.error(`library lookup failed, going on without it: ${errMsg(e)}`);
    }
  }

  const combos = buildMatrix(voices, o.models, o.stabs, lines);
  const totalChars = combos.reduce((s, c) => s + c.chars, 0);
  if (totalChars > o.maxChars) { console.error(`refusing to run: ${num(totalChars)} characters > --max-chars ${num(o.maxChars)}. No render was sent.`); return 2; }
  const estimate = combos.reduce((s, c) => s + c.credits, 0);
  console.log(`rendering ${combos.length} files, ${num(totalChars)} characters, ~${num(estimate)} credits (estimate; check el:credits before/after)`);

  const dir = p('.tmp', 'audition');
  mkdirSync(dir, { recursive: true });
  const width = Math.max(2, String(combos.length).length);
  const rendered: Rendered[] = [];
  const skipped = new Map<string, string>();
  const failures: string[] = [];
  let charsDone = 0, charged = 0, chargedN = 0, streak = 0, aborted = '';
  const writeIndex = (): void => writeFileSync(`${dir}/index.html`, indexHtml(voices, rendered, skipped, { chars: charsDone, when: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC' }));
  for (const c of combos) {
    if (skipped.has(c.voice.id)) continue;
    const tag = `[${String(c.n).padStart(width, '0')}/${combos.length}]`;
    const file = `${String(c.n).padStart(width, '0')}_${slug(c.voice.name) || `voice-${c.voice.id.slice(0, 6)}`}_${c.model}_s${c.stab}_${c.line.key}.mp3`;
    const t0 = Date.now();
    const r = await tts(key, c.voice.id, c.model, c.stab, c.line.text);
    if (r.ok) {
      streak = 0;
      writeFileSync(`${dir}/${file}`, r.audio);
      rendered.push({ combo: c, file });
      charsDone += c.chars;
      if (r.cost !== null) { charged += r.cost; chargedN++; }
      console.log(`${tag} ok   ${c.voice.name} | ${c.model} | s${c.stab} | ${c.line.key} | ${c.chars} chars | ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${file}`);
      writeIndex(); // partial results stay browsable
      continue;
    }
    if (r.needsAdd) {
      const why = `voice ${c.voice.name} (${c.voice.id}${c.voice.owner ? `, public_owner_id ${c.voice.owner}` : ''}) is not usable from this account (${r.message}). If it is a library voice, add it to the account in the ElevenLabs web app (My Voices) first, then run again with --voices ${c.voice.id}. Skipped; nothing was added automatically`;
      console.error(`${tag} SKIP ${why}`);
      skipped.set(c.voice.id, r.message);
      continue;
    }
    failures.push(`${tag} ${c.voice.name} | ${c.model} | s${c.stab} | ${c.line.key}: ${r.message}`);
    console.error(`${tag} FAIL ${c.voice.name} | ${c.model} | s${c.stab} | ${c.line.key}: ${r.message}`);
    if (r.fatal) { aborted = `stopped at once: ${r.message} (key, permission or credits problem)`; break; }
    if (++streak >= MAX_CONSECUTIVE_FAILURES) { aborted = `stopped after ${MAX_CONSECUTIVE_FAILURES} failures in a row`; break; }
  }
  if (rendered.length) writeIndex(); // again: a voice skipped after the last render gets its note

  console.log('\nsummary');
  console.log(`  files: ${rendered.length} of ${combos.length} rendered in .tmp/audition${rendered.length ? ' (open .tmp/audition/index.html in a browser)' : ''}`);
  console.log(`  characters rendered: ${num(charsDone)} | credit estimate ~${num(rendered.reduce((s, r) => s + r.combo.credits, 0))} (estimate; check el:credits before/after)`);
  if (chargedN) console.log(`  character-cost response header: ${num(charged)} credits over ${chargedN} of ${rendered.length} responses`);
  for (const v of voices.filter((x) => x.owner)) console.log(`  library voice: ${v.name} | voice_id ${v.id} | public_owner_id ${v.owner ?? '?'}`);
  for (const id of skipped.keys()) console.log(`  skipped voice ${voices.find((v) => v.id === id)?.name ?? id} (${id}): not usable from this account, see the SKIP line above`);
  if (failures.length) console.log(`  failed requests: ${failures.length} (not retried)`);
  if (aborted) console.log(`  ${aborted}`);
  console.log('  next: npm run el:credits (the balance lags ~1 min); the user listens and names the winning voice');
  return aborted || !rendered.length ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------------------------------------

async function main(): Promise<number> {
  let o: Opts;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`error: ${errMsg(e)} (see --help)`); return 2; }
  if (o.help) { console.log(USAGE); return 0; }
  let sel: { chosen: Line[]; all: Line[] };
  try { sel = loadLines(o.lines); } catch (e) { console.error(`error: ${errMsg(e)}`); return 2; }
  const voices = baseVoices(o.voices);
  return o.run ? await run(o, voices, sel.chosen) : dry(o, voices, sel.chosen, sel.all);
}

process.exitCode = await main();
