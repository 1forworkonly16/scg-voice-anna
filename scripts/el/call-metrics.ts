// Per-call latency, talk share and cost of «scg-anna» calls from the ElevenLabs conversation API. GET only; never prints the key.
//   npm run el:metrics -- <conversation_id> [<conversation_id> …] [--text]
//   npm run el:metrics -- --last N [--text]        the agent's N most recent conversations
// Per agent turn (conversation_turn_metrics.metrics, keys convai_*): time in call, characters, interrupted, tools,
//   ttfa = ttf_audio_since_silence (caller stops -> Anna's voice), wait = turn_silence_before_initiation (end-of-turn wait),
//   llm_ttfb, llm_1st = LLM time to first sentence, tts_ttfb.
// A tool-call entry repeats the metrics of the speech entry before it: it is merged into that row and counted once.
// Latency totals exclude the greeting (no caller turn before it). A «relay» row speaks right after a tool result that carries
// say_* text. Without --text no message text is printed: the first agent message is described (script, length, equal to
// first_message.md, recording words) and the first user message only by script and length (it can hold a name or address);
// --text prints every transcript line to the terminal only (nothing is written to a file).
import { el } from './api.ts';
import { agentId, cfg, p, readText } from './common.ts';

const CHARS_PER_SEC = 14; // talk-share fallback when the call has no TTS audio seconds
const args = process.argv.slice(2);
const showText = args.includes('--text');
const li = args.indexOf('--last');
const lastN = li >= 0 ? Number(args[li + 1]) : 0;
const ids = args.filter((x, i) => !x.startsWith('--') && !(li >= 0 && i === li + 1));
const AGENT = agentId(cfg().name);

const fx = (x: number | undefined, d = 2) => (x === undefined || !Number.isFinite(x) ? '-' : x.toFixed(d));
const pct = (x: number) => `${Math.round(x * 100)}%`;
function median(xs: number[]): number { const s = [...xs].sort((a, b) => a - b), n = s.length; return !n ? NaN : n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2; }
function p90(xs: number[]): number { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil(0.9 * s.length) - 1)]! : NaN; } // nearest rank
const scriptOf = (s: string) => { const c = /[Ѐ-ӿ]/.test(s), l = /[A-Za-zÀ-ž]/.test(s); return c && l ? 'Cyrillic+Latin' : c ? 'Cyrillic' : l ? 'Latin' : 'no letters'; };
const toolName = (c: any): string => c?.tool_name ?? c?.name ?? '?';
const metricsOf = (e: any): Record<string, number> => Object.fromEntries(Object.entries<any>(e.conversation_turn_metrics?.metrics ?? {})
  .map(([k, v]) => [k.replace(/^convai_/, ''), Number(v?.elapsed_time ?? v)]));

const COLS: [string, string][] = [['ttfa', 'ttf_audio_since_silence'], ['wait', 'turn_silence_before_initiation'], ['llm_ttfb', 'llm_service_ttfb'], ['llm_1st', 'llm_service_ttf_sentence'], ['tts_ttfb', 'tts_service_ttfb']];
interface Row { t: number; chars: number; interrupted: boolean; tools: string[]; m: Record<string, number>; greeting: boolean; relay: boolean }

async function report(id: string) {
  const d = await el('GET', `/v1/convai/conversations/${encodeURIComponent(id)}`);
  const md = d.metadata ?? {}, ch = md.charging ?? {};
  const tr: any[] = d.transcript ?? [];
  const start = Number(md.start_time_unix_secs) ? new Date(Number(md.start_time_unix_secs) * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '?';
  console.log(`\n=== ${id} | ${d.agent_name ?? '?'}${d.agent_id === AGENT ? '' : ` (NOT ${cfg().name}: ${d.agent_id})`} | ${start} | status ${d.status}`);

  // rows: one per agent speech / tool generation; tool-result entries skipped; tool calls with the speech row's metrics merged into it
  const rows: Row[] = [];
  let seenUser = false, lastSig = '', last: Row | null = null;
  tr.forEach((e, i) => {
    if (e.role === 'user') { seenUser = true; lastSig = ''; last = null; return; }
    if (e.role !== 'agent') return;
    const msg = String(e.message ?? '');
    const tools: string[] = (e.tool_calls ?? []).map(toolName);
    if (!msg && !tools.length) return;
    const m = metricsOf(e), sig = JSON.stringify(m);
    if (!msg && tools.length && last && Object.keys(m).length && sig === lastSig) { last.tools.push(...tools); return; }
    const prev = tr[i - 1];
    const relay = !!msg && prev?.role === 'agent' && (prev.tool_results ?? []).some((r: any) => /"say_[a-z]{2}"/.test(typeof r.result_value === 'string' ? r.result_value : JSON.stringify(r.result_value ?? '')));
    const row: Row = { t: Number(e.time_in_call_secs), chars: msg.length, interrupted: !!e.interrupted, tools, m, greeting: !seenUser, relay };
    rows.push(row); last = row; lastSig = sig;
  });

  console.log(['t(s)'.padStart(5), 'chars'.padStart(5), 'int', 'tools'.padEnd(28), ...COLS.map(([h]) => h.padStart(8)), ' note'].join(' '));
  for (const r of rows) console.log([String(r.t).padStart(5), String(r.chars).padStart(5), r.interrupted ? 'YES' : ' - ', (r.tools.join(',') || '-').padEnd(28), ...COLS.map(([, k]) => fx(r.m[k]).padStart(8)), ` ${r.greeting ? 'greeting' : r.relay ? 'relay' : ''}`].join(' '));

  const resp = rows.filter((r) => !r.greeting);
  console.log(`\nlatency (s), ${resp.length} rows after the greeting, tool-call duplicates merged:`);
  for (const [h, k] of COLS) {
    const xs = resp.map((r) => r.m[k]).filter((x): x is number => x !== undefined && Number.isFinite(x));
    console.log(`  ${h.padEnd(8)} ${k.padEnd(31)} ${xs.length ? `median ${fx(median(xs))}  p90 ${fx(p90(xs))}  max ${fx(Math.max(...xs))}  (n=${xs.length})` : 'n/a'}`);
  }
  const speech = resp.filter((r) => r.chars > 0 && !r.relay);
  const relays = resp.filter((r) => r.relay).length;
  console.log(`  interrupted agent turns: ${rows.filter((r) => r.interrupted).length}`);
  console.log(`median agent turn: ${fx(median(speech.map((r) => r.chars)), 0)} chars (n=${speech.length}; excl. the greeting and ${relays} say_* relays), p90 ${fx(p90(speech.map((r) => r.chars)), 0)}, max ${speech.length ? Math.max(...speech.map((r) => r.chars)) : '-'}`);

  const dur = Number(md.call_duration_secs), min = dur / 60;
  const ttsSecs = Number(ch.tts_usage?.total_audio_output_seconds);
  const agentChars = rows.reduce((s, r) => s + r.chars, 0);
  if (dur > 0) console.log(`agent talk share: ${Number.isFinite(ttsSecs) && ttsSecs > 0
    ? `${pct(ttsSecs / dur)} (TTS audio ${fx(ttsSecs, 1)} s / call ${dur} s, metadata.charging.tts_usage)`
    : `${pct(agentChars / CHARS_PER_SEC / dur)} (ESTIMATE: ${agentChars} agent chars at ~${CHARS_PER_SEC} chars/s / call ${dur} s; no TTS seconds in the data)`}`);
  const cost = Number(md.cost), llmUsd = Number(ch.llm_price), llmCr = Number(ch.llm_charge);
  console.log(`duration ${dur} s (${fx(min)} min) | cost ${Number.isFinite(cost) ? cost : '?'} credits = ${min > 0 && Number.isFinite(cost) ? Math.round(cost / min) : '?'} credits/min`
    + ` | LLM $${fx(llmUsd, 4)} ($${min > 0 ? fx(llmUsd / min, 4) : '?'}/min; ${Number.isFinite(llmCr) ? `${llmCr} credits = ${Math.round(llmCr / min)}/min` : 'credits ?'}) | voice ${ch.call_charge ?? '?'} credits | TTS ${ch.tts_usage?.primary_tts_model ?? '?'}`);

  const ld = tr.flatMap((e) => (e.tool_calls ?? []).filter((c: any) => toolName(c) === 'language_detection').map((c: any) => {
    let lang = '?'; try { lang = JSON.parse(c.params_as_json ?? '{}').language ?? '?'; } catch { /* keep ? */ }
    return `${lang} at ${e.time_in_call_secs} s`;
  }));
  const ov = d.conversation_initiation_client_data?.conversation_config_override?.agent?.language ?? null;
  console.log(`language_detection: ${ld.length ? `${ld.length}x (${ld.join(', ')})` : 'not called'} | main_language ${md.main_language ?? '?'} | client language override: ${ov ?? 'none'}`);
  const fa = String(tr.find((e) => e.role === 'agent' && e.message)?.message ?? '');
  const fu = String(tr.find((e) => e.role === 'user' && e.message)?.message ?? '');
  const greeting = readText(p('elevenlabs', 'prompt', 'first_message.md')).trim();
  console.log(`first agent message [${scriptOf(fa)}, ${fa.length} chars, ${fa.trim() === greeting ? '= first_message.md' : 'NOT first_message.md'}, recording words: ${/записыва|ierakst/iu.test(fa) ? 'YES' : 'none'}]${showText ? `: «${fa}»` : ''}`);
  console.log(`first user message [${scriptOf(fu)}, ${fu.length} chars]${showText ? `: «${fu}»` : ''}`);

  if (showText) {
    console.log('\n--- transcript (terminal only) ---');
    for (const e of tr) {
      const tools = (e.tool_calls ?? []).map(toolName);
      if (e.message) console.log(`${String(e.time_in_call_secs).padStart(5)} ${String(e.role).padEnd(5)} ${e.message}`);
      else if (tools.length) console.log(`${String(e.time_in_call_secs).padStart(5)} ${String(e.role).padEnd(5)} [tool call: ${tools.join(', ')}]`);
    }
  }
}

if (lastN > 0) {
  const l = await el('GET', `/v1/convai/conversations?agent_id=${encodeURIComponent(AGENT)}&page_size=${Math.min(Math.floor(lastN), 100)}`);
  ids.push(...(l.conversations ?? []).slice(0, lastN).map((c: any) => c.conversation_id as string));
}
if (!ids.length) { console.error('usage: npm run el:metrics -- <conversation_id> [--text] | --last N [--text]'); process.exit(2); }
for (const id of ids) await report(id);
