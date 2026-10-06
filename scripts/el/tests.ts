// ElevenLabs Tests for «scg-anna»: builds the tests from elevenlabs/test_specs/*.json, runs them, scores them.
//   node scripts/el/tests.ts dry [--only "t01,t02"]       OFFLINE: build the tests and print one line per test (zero API calls)
//   node scripts/el/tests.ts sync                         create/update the tests, write elevenlabs/tests.json
//   node scripts/el/tests.ts run --llm <model> --repeat N [--only crit|all|noncrit|"id,id"] [--label x]
//   node scripts/el/tests.ts show <label>                 re-print the scoring of a saved run
// --only: ids or id prefixes ("t07" = t07_*, not t07b_*). Quote a comma list in PowerShell 5.1 («--only "t01,t02"»);
// an unquoted list arrives split («--only t01 t02») and is joined back.
// Language: the agent starts in agent_config.json agent.language (DEF). A recorded language_detection(<caller language>)
// turn is injected into a history only when the spec's caller language differs from DEF (with DEF=lv: ru after the LV greeting).
// SAFETY: next_reply ("llm") and tool_call tests never execute tools (the platform returns "Skipping tool call in test mode");
// simulations mock EVERY tool (mocking_strategy all, fallback raise_error, mocks from the specs), so nothing reaches the live Worker,
// the Calendar, the Sheet or Telegram. check_no_live_calls() proves it afterwards from the tool-execution log.
// Scoring = platform verdict AND deterministic checks (expect.reply_must_not on every agent turn; expect.reply_must on text tests
// that relay a tool, or with expect.reply_must_lexical; expect.no_tools: the reply contains no tool call; expect.no_speech: the
// agent says nothing). History tool calls carry the tool's fixed filler from system_prompt.md §5 (system tools: none).
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { el, sleep } from './api.ts';
import { agentId, cfg, p, readJson, readText, writeJson } from './common.ts';

const toolsFile = readJson(p('elevenlabs', 'tools.json'));
const SYSTEM_TOOLS = new Set(['language_detection', 'skip_turn', 'end_call']); // referenced by name (type system); no filler before them
const toolId = (n: string): { id: string; type: string } => SYSTEM_TOOLS.has(n) ? { id: n, type: 'system' } : { id: toolsFile.tools[n].id, type: 'webhook' };
// Anna's fixed filler per tool, read from system_prompt.md §5 («- `tool`: RU «…» LV «…»»), so the histories say what the prompt says.
const FILLERS = new Map([...readText(p('elevenlabs', 'prompt', 'system_prompt.md')).matchAll(/^\s*-\s*`(\w+)`:\s*RU «([^»]+)»\s*LV «([^»]+)»\s*$/gm)].map((m) => [m[1]!, { ru: m[2]!, lv: m[3]! }]));
function filler(tool: string, lang: string): string | null {
  if (SYSTEM_TOOLS.has(tool)) return null;
  const f = FILLERS.get(tool);
  if (!f) throw new Error(`no fixed filler for ${tool} in elevenlabs/prompt/system_prompt.md §5`);
  return lang === 'lv' ? f.lv : f.ru;
}
const SPEC_DIR = p('elevenlabs', 'test_specs');
const OUT_DIR = p('elevenlabs', 'test_results');

type Spec = any;
const LOOKUP_MOCK = readJson(p('elevenlabs', 'test_specs', 't03_s1_sourced_facts_only.json')).mocked_tools.lookup_building;
const loadSpecs = (): Spec[] => readdirSync(SPEC_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => readJson(p('elevenlabs', 'test_specs', f)));

// ---------- history conversion ----------
let reqN = 0;
const callEntry = (tool: string, args: unknown, message: string | null, t: number) => {
  const rid = `toolu_test_${++reqN}`;
  const sys = SYSTEM_TOOLS.has(tool);
  return { rid, entry: { role: 'agent', message, tool_calls: [{ type: sys ? 'system' : 'webhook', request_id: rid, tool_name: tool, params_as_json: JSON.stringify(args), tool_has_been_called: true, tool_details: null }], tool_results: [], time_in_call_secs: t } };
};
const resultEntry = (rid: string, tool: string, result: unknown, t: number) => ({
  role: 'agent', message: null, tool_calls: [],
  tool_results: [{ request_id: rid, tool_name: tool, result_value: JSON.stringify(result), is_error: false, is_blocked: false, tool_has_been_called: true, tool_latency_secs: 0.6, error_type: '', raw_error_message: '', dynamic_variable_updates: [], type: SYSTEM_TOOLS.has(tool) ? 'system' : 'webhook' }],
  time_in_call_secs: t,
});

/** The default language of the agent (the session starts in it) and the language of a text (Cyrillic = ru, else lv). */
const DEF: string = cfg().agent.language;
const langOf = (s: string) => (hasCyr(s) ? 'ru' : 'lv');
const LANG_NAME: Record<string, string> = { ru: 'Russian', lv: 'Latvian', en: 'English' };

/** The recorded language_detection(lang) call + result that a real call holds before Anna's first reply in a language other than DEF. */
function langSwitch(lang: string, t: number): any[] {
  const reason = `Caller answered in ${LANG_NAME[lang] ?? lang}`;
  const { rid, entry } = callEntry('language_detection', { reason, language: lang }, null, t);
  return [entry, resultEntry(rid, 'language_detection', { result_type: 'language_detection_success', status: 'success', reason, language: lang }, t + 1)];
}

function convertHistory(hist: any[], callerLang: string): any[] {
  const out: any[] = []; let t = 0; let agentTurns = 0;
  let switched = hist.some((m) => m.tool_calls?.some((c: any) => c.name === 'language_detection'));
  for (const m of hist) {
    t += 4;
    // The session starts in DEF; before Anna's first reply in another language a real call holds language_detection(<that language>);
    // add it so the history is realistic (DEF=lv: ru before the first Russian reply after the LV greeting). Only for callers whose language is not DEF.
    if (m.role === 'agent' && agentTurns++ > 0 && !switched && callerLang !== DEF && langOf(m.message ?? '') !== DEF) { out.push(...langSwitch(langOf(m.message ?? ''), t)); switched = true; t += 2; }
    if (m.role === 'agent' && !m.tool_calls?.length && /^Нашла: Ilūkstes iela 16/.test(m.message ?? '')) { // the specs write the lookup answer without the call; add it so the history is realistic
      const { rid, entry } = callEntry('lookup_building', { language: 'ru', address: 'Ilūkstes iela 16' }, filler('lookup_building', 'ru'), t);
      out.push(entry); out.push(resultEntry(rid, 'lookup_building', LOOKUP_MOCK, t)); t += 1;
    }
    if (m.tool_calls?.length) { // spec format {name,args,result} -> platform format (call entry + result entry)
      const first = m.tool_calls[0];
      const { rid, entry } = callEntry(first.name, first.args ?? {}, filler(first.name, callerLang), t);
      out.push(entry); out.push(resultEntry(rid, first.name, first.result ?? {}, t));
      out.push({ role: 'agent', message: m.message, tool_calls: [], tool_results: [], time_in_call_secs: t + 1 });
    } else out.push({ role: m.role, message: m.message, tool_calls: [], tool_results: [], time_in_call_secs: t });
  }
  return out;
}

// Plausible arguments for the injected (already executed) call, so the next-reply test judges the RELAY of the mocked result.
function relayArgs(spec: Spec, tool: string): any {
  const base = { language: 'ru' };
  if (tool === 'quote_range') return { ...base, floors: 9, stairwells: 4, apartments: 144 };
  if (tool === 'lookup_building') return { ...base, address: 'Ilūkstes iela 16' };
  if (tool === 'book_inspection') return { ...base, slot_start: spec.id.startsWith('t12') ? '2026-10-09T14:00:00+03:00' : '2026-10-08T10:00:00+03:00', address_spoken: 'Ilūkstes iela 16', floors: 9, stairwells: 4, apartments: 144, caller_role: 'other', name: 'Нина Ивановна', phone: '20123456', consent: true };
  return base;
}

function hasCyr(s: string) { return /[Ѐ-ӿ]/.test(s ?? ''); }
/** A caller whose language differs from DEF answers the greeting in it: Anna calls language_detection(<caller language>) first;
 *  the next-reply tests start from that state (DEF=lv: a Russian answer to the LV greeting). Callers in DEF get no switch. */
function needsLangSwitchInjection(spec: Spec): boolean {
  if (spec.expect?.tool === 'language_detection' || spec.language === DEF || spec.id.startsWith('t01') || spec.type === 'simulation') return false;
  const agentTurns = spec.chat_history.filter((m: any) => m.role === 'agent');
  return agentTurns.length === 1 && spec.chat_history.at(-1).role === 'user' && langOf(spec.chat_history.at(-1).message) === spec.language;
}

function buildHistory(spec: Spec, injectTool?: string): any[] {
  const h = convertHistory(spec.chat_history, spec.language);
  let t = (h.at(-1)?.time_in_call_secs ?? 0);
  if (needsLangSwitchInjection(spec)) { h.push(...langSwitch(spec.language, t + 1)); t += 2; }
  if (injectTool) {
    const { rid, entry } = callEntry(injectTool, relayArgs(spec, injectTool), filler(injectTool, spec.language), t + 1);
    h.push(entry); h.push(resultEntry(rid, injectTool, spec.mocked_tools[injectTool], t + 2));
  }
  return h;
}

// ---------- test request builders ----------
function conditionText(spec: Spec, relay: boolean): string {
  const e = spec.expect ?? {};
  // t01: the static half (config check) is verified by check-agent; the LLM judges only the dynamic half.
  const parts = [spec.id.startsWith('t01') ? spec.success_condition.replace(/^.*?Dynamic part:\s*/s, '') : spec.success_condition];
  // reply_must / reply_must_not are enforced deterministically in detChecks(); the LLM judge only gets the semantic condition (it hallucinated matches of forbidden Latvian phrases).
  if (relay) parts.push('The tool call and its result are already in the conversation: judge only the agent\'s reply that follows the result, which must relay the tool\'s say_ru text.');
  parts.push('Latvian names (Ilūkstes iela, Purvciems, Rīgas namu pārvaldnieks, Parauga iela) are fine inside Russian text. Replying in Russian is correct for a Russian-speaking caller.');
  return parts.join(' ');
}
// WP3 spec drift vs the contract: new_window enum is '09:00-13:00' | '13:00-17:00' (src/lib/works.ts ACCESS_WINDOWS), the specs say '13-17'.
function fixSpecValue(k: string, v: unknown): unknown {
  if (k === 'new_window' && typeof v === 'string' && /^\d{2}-\d{2}$/.test(v)) return v.split('-').map((h) => `${h}:00`).join('-');
  return v;
}
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function paramEval(v: unknown) {
  if (typeof v === 'boolean') return { type: 'regex', pattern: `(?i)^${v}$` };
  if (typeof v === 'number') return { type: 'exact', expected_value: String(v) };
  const s = String(v);
  if (/^\d+$/.test(s)) return { type: 'exact', expected_value: s };
  if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}-\d{2}$/.test(s)) return { type: 'exact', expected_value: s };
  return { type: 'regex', pattern: `(?i)${escRe(s)}` };
}
function maxTurns(spec: Spec): number { const m = /Max (\d+) turns/i.exec(spec.success_condition + ' ' + spec.scenario); return m ? Number(m[1]) : 16; }

interface Built { key: string; spec: Spec; critical: boolean; derived: boolean; body: any; }
function buildAll(): Built[] {
  const list: Built[] = [];
  for (const spec of loadSpecs()) {
    const e = spec.expect ?? {};
    const name = `scg-${spec.id}`;
    if (spec.type === 'next_reply') {
      const inject = e.tool && spec.mocked_tools?.[e.tool] ? e.tool : undefined;
      list.push({ key: spec.id, spec, critical: !!spec.critical, derived: false, body: { type: 'llm', name, chat_history: buildHistory(spec, inject), success_condition: conditionText(spec, !!inject), success_examples: [], failure_examples: [], dynamic_variables: {} } });
    } else if (spec.type === 'tool_call') {
      const params = Object.entries(e.args_contains ?? {}).map(([k, v]) => ({ path: SYSTEM_TOOLS.has(e.tool) ? k : `body.${k}`, eval: paramEval(fixSpecValue(k, v)) }));
      list.push({ key: spec.id, spec, critical: !!spec.critical, derived: false, body: { type: 'tool', name, chat_history: buildHistory(spec), tool_call_parameters: { referenced_tool: toolId(e.tool), parameters: params, verify_absence: false }, check_any_tool_matches: false, dynamic_variables: {} } });
      if (e.reply_must?.length && spec.mocked_tools?.[e.tool]) { // t22: also test the relay of the mocked result in Russian
        const rel = { ...spec, id: spec.id + '_relay' };
        list.push({ key: rel.id, spec: rel, critical: !!spec.critical, derived: true, body: { type: 'llm', name: `scg-${rel.id}`, chat_history: buildHistory(spec, e.tool), success_condition: conditionText(spec, true), success_examples: [], failure_examples: [], dynamic_variables: {} } });
      }
    } else if (spec.type === 'simulation') {
      const ids = Object.keys(spec.mocked_tools).map((n) => toolId(n).id);
      const overrides: Record<string, any[]> = {};
      for (const [n, v] of Object.entries(spec.mocked_tools)) overrides[toolId(n).id] = [{ parameter_conditions: [], mock_result: JSON.stringify(v), is_error: false }];
      list.push({ key: spec.id, spec, critical: !!spec.critical, derived: false, body: {
        type: 'simulation', name, chat_history: buildHistory(spec), success_conditions: [conditionText(spec, false)], simulation_scenario: spec.scenario, simulation_max_turns: maxTurns(spec),
        tool_mock_config: { mocking_strategy: 'all', fallback_strategy: 'raise_error', mocked_tool_ids: ids }, tool_mock_overrides: overrides,
        dynamic_variables: {} } }); // simulated user + evaluator use the platform default (claude-sonnet-4-6; haiku is not supported for simulations)
    } else throw new Error('unknown spec type ' + spec.type);
  }
  return list;
}

// ---------- sync ----------
async function sync() {
  const f = p('elevenlabs', 'tests.json');
  const prev = existsSync(f) ? readJson(f) : { tests: {} };
  const existing = new Map<string, string>();
  let cursor: string | null = null;
  do { const j: any = await el('GET', `/v1/convai/agent-testing?page_size=100${cursor ? '&cursor=' + cursor : ''}`); for (const t of j.tests ?? []) existing.set(t.name, t.id); cursor = j.has_more ? j.next_cursor : null; } while (cursor);
  const out: Record<string, any> = {};
  for (const b of buildAll()) {
    let id: string | undefined = prev.tests?.[b.key]?.test_id ?? existing.get(b.body.name);
    if (id) { try { await el('PUT', `/v1/convai/agent-testing/${id}`, b.body); } catch (e: any) { if (e.status === 404) id = undefined; else throw e; } }
    if (!id) id = (await el('POST', '/v1/convai/agent-testing/create', b.body)).id;
    out[b.key] = { test_id: id, name: b.body.name, type: b.spec.type, critical: b.critical, derived: b.derived, language: b.spec.language };
  }
  writeJson(f, { _note: 'GENERATED by scripts/el/tests.ts sync from elevenlabs/test_specs/*.json. Ids only.', agent: 'scg-anna', tests: out });
  console.log(`tests.json: ${Object.keys(out).length} tests (${Object.values<any>(out).filter((t) => t.critical).length} critical)`);
}

// ---------- dry (offline) ----------
/** --only filter: all | crit | noncrit | a comma (or space) list of ids or id prefixes; a prefix matches the id or «<prefix>_…» (t07 ≠ t07b). */
function picked(key: string, critical: boolean, only: string): boolean {
  if (only === 'all') return true;
  if (only === 'crit') return critical;
  if (only === 'noncrit') return !critical;
  return only.split(/[\s,]+/).filter(Boolean).some((x) => key === x || key.startsWith(x + '_'));
}

/** Prints one line per built test: id, spec type, caller language, injected language_detection, first agent message. No API call. */
function dry(a: Map<string, string>) {
  const only = a.get('only') || 'all';
  const greeting = readText(p('elevenlabs', 'prompt', 'first_message.md')).trim();
  const ldCalls = (h: any[], k: 'name' | 'tool_name') => h.flatMap((m) => (m.tool_calls ?? []).filter((c: any) => c[k] === 'language_detection'));
  const all = buildAll();
  const list = all.filter((b) => picked(b.key, b.critical, only));
  console.log(`DEF=${DEF} (agent_config.json agent.language); ${list.length} of ${all.length} tests (filter: ${only}); greet = first agent message equals first_message.md`);
  console.log(['id'.padEnd(40), 'type'.padEnd(12), 'lang', 'inject'.padEnd(7), 'expect'.padEnd(30), 'greet', 'first agent message (60)'].join(' '));
  for (const b of list) {
    const spec = b.spec;
    const injected = ldCalls(b.body.chat_history, 'tool_name').slice(ldCalls(spec.chat_history, 'name').length).map((c: any) => JSON.parse(c.params_as_json).language);
    const e = spec.expect ?? {};
    const exp = [e.tool, e.no_tools ? 'no_tools' : '', e.no_speech ? 'no_speech' : '', e.reply_must?.length ? (e.reply_must_lexical ? 'must(lex)' : 'must') : '', e.reply_must_not?.length ? 'must_not' : ''].filter(Boolean).join(' ') || '-';
    const first = String(spec.chat_history.find((m: any) => m.role === 'agent')?.message ?? '');
    console.log([b.key.padEnd(40), `${spec.type}${b.derived ? '*' : ''}`.padEnd(12), String(spec.language).padEnd(4), (injected.join(',') || '-').padEnd(7), exp.padEnd(30), (first.trim() === greeting ? 'ok' : 'DIFF').padEnd(5), first.slice(0, 60).replace(/\s+/g, ' ')].join(' '));
  }
  console.log('* derived test (relay of the mocked result). Zero API calls were made.');
}

// ---------- run + score ----------
async function run(a: Map<string, string>) {
  const tj = readJson(p('elevenlabs', 'tests.json')).tests as Record<string, any>;
  const only = a.get('only') || 'all';
  const keys = Object.keys(tj).filter((k) => picked(k, !!tj[k].critical, only));
  const llm = a.get('llm'); const repeat = Number(a.get('repeat') ?? 1); const label = a.get('label') ?? `${llm ?? 'cur'}_${only}_${Date.now()}`;
  const id = agentId(cfg().name);
  if (llm) await el('PATCH', `/v1/convai/agents/${id}`, { conversation_config: { agent: { prompt: { llm } } } });
  const cur = (await el('GET', `/v1/convai/agents/${id}`)).conversation_config.agent.prompt.llm;
  console.log(`running ${keys.length} tests x${repeat} on ${cur}`);
  const body: any = { tests: keys.map((k) => ({ test_id: tj[k].test_id })), repeat_count: repeat };
  const inv = await el('POST', `/v1/convai/agents/${id}/run-tests`, body);
  const invId = inv.id as string;
  let res: any;
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    res = await el('GET', `/v1/convai/test-invocations/${invId}`);
    const pend = (res.test_runs ?? []).filter((r: any) => r.status === 'pending').length;
    if ((res.test_runs ?? []).length && !pend) break;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeJson(p('elevenlabs', 'test_results', `${label}.json`), { label, llm: cur, repeat, invocation: invId, runs: slim(res) });
  score(label, slim(res), tj, cur, repeat);
}

function slim(res: any) {
  return (res.test_runs ?? []).map((r: any) => ({ test_id: r.test_id, test_name: r.test_name, status: r.status, result: r.condition_result?.result, rationale: (r.condition_result?.rationale?.summary ?? JSON.stringify(r.condition_result?.rationale ?? '')).slice(0, 500),
    credits: r.credits_used, llm_price: r.charging?.llm_price ?? null, analysis: r.charging?.analysis ?? null,
    agent: (r.agent_responses ?? []).filter((m: any) => m.role === 'agent').map((m: any) => ({ message: m.message, tools: (m.tool_calls ?? []).map((c: any) => ({ name: c.tool_name, args: c.params_as_json })) })) }));
}

function detChecks(key: string, spec: Spec, agent: { message: string | null; tools: any[] }[]): string[] {
  const ns = (x: string) => x.toLowerCase().replace(/\s+/g, ''); // the platform joins streamed chunks with stray spaces («Н ДС»): compare whitespace-free
  const text = ns(agent.map((m) => m.message ?? '').join(' '));
  const issues: string[] = [];
  for (const s of spec.expect?.reply_must_not ?? []) if (text.includes(ns(String(s)))) issues.push(`MUST_NOT «${s}»`);
  // reply_must is a lexical check only for verbatim tool relays (expect.tool set) and fixed lines (expect.reply_must_lexical, e.g. «Алло, вы меня слышите?»);
  // other free-text answers are judged by the LLM (paraphrases are fine)
  if (spec.type !== 'tool_call' && (spec.expect?.tool || spec.expect?.reply_must_lexical)) for (const s of spec.expect?.reply_must ?? []) if (!text.includes(ns(String(s)))) issues.push(`missing «${s}»`);
  // expect.no_tools: the reply must not contain any tool call (e.g. no language_detection for a caller who already speaks DEF)
  if (spec.expect?.no_tools) { const used = agent.flatMap((m) => (m.tools ?? []).map((c: any) => c.name)); if (used.length) issues.push(`NO_TOOLS: called ${used.join(',')}`); }
  // expect.no_speech: the agent says nothing (e.g. skip_turn while the caller stays silent after the check-in)
  if (spec.expect?.no_speech && text) issues.push(`NO_SPEECH: said «${agent.map((m) => m.message ?? '').join(' ').trim().slice(0, 60)}»`);
  return issues;
}

function score(label: string, runs: any[], tj: Record<string, any>, llm: string, repeat: number) {
  const byId = new Map(Object.entries(tj).map(([k, v]) => [v.test_id, k]));
  const specs = new Map<string, Spec>(); for (const s of loadSpecs()) specs.set(s.id, s);
  const per: Record<string, { pass: number; n: number; notes: string[] }> = {};
  let usd = 0, credits = 0;
  for (const r of runs) {
    const key = byId.get(r.test_id) ?? r.test_name; const base = key.replace(/_relay$/, '');
    const spec = specs.get(base) ?? {};
    const det = detChecks(key, key.endsWith('_relay') ? { ...spec, type: 'next_reply' } : spec, r.agent);
    const ok = r.status === 'passed' && !det.length;
    const e = (per[key] ??= { pass: 0, n: 0, notes: [] }); e.n++; if (ok) e.pass++; else e.notes.push(`${r.status}${det.length ? ' det:' + det.join(',') : ''} | ${String(r.rationale).slice(0, 220)}`);
    usd += r.llm_price ?? 0; credits += r.credits ?? 0;
  }
  const crit = Object.keys(per).filter((k) => tj[k]?.critical);
  const lines = Object.entries(per).sort().map(([k, v]) => `${v.pass === v.n ? 'PASS' : v.pass ? 'PART' : 'FAIL'} ${v.pass}/${v.n} ${tj[k]?.critical ? '[CRIT]' : '      '} ${k}${v.notes.length ? '\n      ' + v.notes.slice(0, 2).join('\n      ') : ''}`);
  console.log(lines.join('\n'));
  const cp = crit.reduce((s, k) => s + per[k]!.pass, 0), cn = crit.reduce((s, k) => s + per[k]!.n, 0);
  const ap = Object.values(per).reduce((s, v) => s + v.pass, 0), an = Object.values(per).reduce((s, v) => s + v.n, 0);
  console.log(`\n[${label}] model ${llm} x${repeat}: critical ${cp}/${cn}, all ${ap}/${an}; reported llm_price $${usd.toFixed(4)}, credits ${credits}`);
}

const [cmd, ...rest] = process.argv.slice(2);
// --key value [value …]: values up to the next --flag are joined with commas (PowerShell 5.1 splits an unquoted «t01,t02»)
const a = new Map<string, string>(); let flagKey: string | null = null;
for (const x of rest) { if (x.startsWith('--')) { flagKey = x.slice(2); a.set(flagKey, ''); } else if (flagKey !== null) a.set(flagKey, a.get(flagKey) ? `${a.get(flagKey)},${x}` : x); }
if (cmd === 'dry') dry(a);
else if (cmd === 'sync') await sync();
else if (cmd === 'run') await run(a);
else if (cmd === 'rescore') { const j = readJson(p('elevenlabs', 'test_results', `${rest[0]}.json`)); score(j.label, j.runs, readJson(p('elevenlabs', 'tests.json')).tests, j.llm, j.repeat); }
else if (cmd === 'show') { const j = readJson(p('elevenlabs', 'test_results', `${rest[0]}.json`)); console.log(JSON.stringify(j.runs.map((r: any) => ({ t: r.test_name, s: r.status, usd: r.llm_price, cr: r.credits })), null, 0)); }
else { console.error('usage: tests.ts dry [--only "t01,t05"] | sync | run --llm M --repeat N [--only crit|all|noncrit|"t01,t05"] | rescore <label> | show <label>'); process.exit(2); }
