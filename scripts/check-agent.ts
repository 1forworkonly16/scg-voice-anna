// Asserts the live agent «scg-anna» matches the config and the demo rules. Exit 0 = all PASS.
//   node scripts/check-agent.ts [--allow-unlocked] [--json]
// --allow-unlocked: do not fail when auth is OFF (use only while a talk-to call is intended; the end state must be locked).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { el } from './el/api.ts';
import { agentId, cfg, p, readAgents, readJson, loadContract } from './el/common.ts';
import { buildBody } from './build-agent.ts';

const c = cfg();
const id = agentId(c.name);
const allowUnlocked = process.argv.includes('--allow-unlocked');
const rows: { ok: boolean; name: string; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = '') => rows.push({ ok: !!ok, name, detail });
const eq = (name: string, got: unknown, want: unknown) => check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (name: string, got: unknown, want: number) => check(name, typeof got === 'number' && Math.abs(got - want) < 1e-6, `got ${JSON.stringify(got)}, want ${want}`);
const def: string = c.agent.language;
const langs: string[] = c.agent.language_presets ?? [];
const presetsFile = readJson(p('elevenlabs', 'prompt', 'presets.json'));
const DISCLOSURE: Record<string, RegExp> = { ru: /ИИ/, lv: /mākslīgā intelekta/, en: /\bAI\b/ }; // AI disclosure in the greeting, per language
const RECORDING = /записыва|ierakst/iu; // audio recording is off (decision 2026-10-05): no greeting may mention recording

const a = await el('GET', `/v1/convai/agents/${id}`);
const cc = a.conversation_config, ps = a.platform_settings, pr = cc.agent.prompt;
const state = readAgents().agents[c.name];
const toolsFile = readJson(p('elevenlabs', 'tools.json'));
const toolIds: string[] = Object.entries<any>(toolsFile.tools).filter(([n]) => !c.tools || c.tools.includes(n)).map(([, t]) => t.id); // allowlist from agent_config.json

// agent identity and model
eq('agent name', a.name, c.name);
eq('default language', cc.agent.language, def);
eq('TTS model', cc.tts.model_id, c.tts.model_id);
eq('voice = agent_config tts.voice_id', cc.tts.voice_id, c.tts.voice_id);
near('tts speed', cc.tts.speed, c.tts.speed);
near('tts stability', cc.tts.stability, c.tts.stability);
near('tts similarity_boost', cc.tts.similarity_boost, c.tts.similarity_boost);
eq('expressive_mode off (no audio tags)', cc.tts.expressive_mode, false);
check('LLM is one of the allowed Claude models', ['claude-haiku-4-5', 'claude-sonnet-5-5'].includes(pr.llm), `llm=${pr.llm}`);
eq('LLM matches agents.json', pr.llm, state?.llm);
// language presets: one per agent_config agent.language_presets (the default included), nothing stale
eq('language presets = agent_config language_presets', Object.keys(cc.language_presets ?? {}).sort(), [...langs].sort());
for (const l of langs) {
  const o = cc.language_presets?.[l]?.overrides; // missing preset -> the checks below FAIL, no crash
  const fm: string = o?.agent?.first_message ?? '';
  eq(`${l} preset language`, o?.agent?.language ?? null, l);
  eq(`${l} preset: no per-language voice override (ONE voice)`, o?.tts?.voice_id ?? null, null);
  check(`${l} preset carries no prompt override (the platform ignores it; probe 2026-10-03)`, !o?.agent?.prompt?.prompt, '');
  eq(`${l} preset first_message = presets.json`, o?.agent?.first_message ?? null, presetsFile[l]?.first_message ?? null);
  check(`${l} preset first_message has the AI disclosure`, !!DISCLOSURE[l]?.test(fm), `«${fm}»`);
  check(`${l} preset first_message says nothing about recording`, !RECORDING.test(fm), `«${fm}»`);
  eq(`${l} preset max-duration message`, o?.agent?.max_conversation_duration_message ?? null, c.agent.max_duration_message?.[l] ?? null);
  eq(`${l} preset soft-timeout message`, o?.turn?.soft_timeout_config?.message ?? null, c.turn.soft_timeout_message?.[l] ?? null);
}
check(`default (${def}) first_message has the AI disclosure`, !!DISCLOSURE[def]?.test(cc.agent.first_message ?? ''), `«${cc.agent.first_message}»`);
check(`default (${def}) first_message says nothing about recording`, !RECORDING.test(cc.agent.first_message ?? ''), `«${cc.agent.first_message}»`);
eq(`default max-duration message = ${def}`, cc.agent.max_conversation_duration_message, c.agent.max_duration_message?.[def]);
// prompt in sync with the repo files
const expected = buildBody(state?.webhook_id ?? null, toolIds);
eq('prompt text in sync with elevenlabs/prompt/*', pr.prompt, expected.conversation_config.agent.prompt.prompt);
eq('first_message in sync', cc.agent.first_message, expected.conversation_config.agent.first_message);
check('prompt carries the 4 WP3 lines', ['Latin letters', 'exactly as the tool', 'Never output bracketed tags', 'correct case'].every((s) => pr.prompt.includes(s)));
// tools
eq('tool_ids = the 7 generated tools', [...(pr.tool_ids ?? [])].sort(), [...toolIds].sort());
const { toElevenLabsTool, TOOL_NAMES } = await loadContract();
for (const n of TOOL_NAMES) {
  const t = (await el('GET', `/v1/convai/tools/${toolsFile.tools[n].id}`)).tool_config;
  const bodyProps = t.api_schema.request_body_schema.properties;
  const want = toElevenLabsTool(n, { baseUrl: c.worker_url });
  check(`tool ${n}: url + POST`, t.api_schema.url === `${c.worker_url}/tools/${n}` && t.api_schema.method === 'POST', t.api_schema.url);
  check(`tool ${n}: x-scg-key header is a workspace secret`, t.api_schema.request_headers?.['x-scg-key']?.secret_id === toolsFile.secret_id, '');
  check(`tool ${n}: conversation_id bound to system__conversation_id`, bodyProps.conversation_id?.dynamic_variable === 'system__conversation_id', '');
  check(`tool ${n}: timeout ${want.response_timeout_secs}s, params match contract`, t.response_timeout_secs === want.response_timeout_secs && JSON.stringify(Object.keys(bodyProps).sort()) === JSON.stringify(Object.keys(want.api_schema.request_body_schema.properties).sort()), `timeout=${t.response_timeout_secs}`);
}
const sec = (await el('GET', '/v1/convai/secrets')).secrets ?? [];
const tsec = sec.find((s: any) => s.name === c.tool_secret_name);
check('workspace secret scg_tool_key exists', !!tsec && tsec.secret_id === toolsFile.secret_id, '');
const sysTools = Object.entries(pr.built_in_tools ?? {}).filter(([, v]) => v).map(([k]) => k).sort();
eq('system tools = language_detection + end_call', sysTools, ['end_call', 'language_detection']);
// limits and privacy
eq('max_duration_seconds', cc.conversation.max_duration_seconds, 300);
eq('daily_limit', ps.call_limits.daily_limit, 25);
eq('agent_concurrency_limit', ps.call_limits.agent_concurrency_limit, 2);
eq('bursting_enabled off', ps.call_limits.bursting_enabled, false);
eq('retention_days', ps.privacy.retention_days, 90);
eq('record_voice off (audio not stored)', ps.privacy.record_voice, false);
check(allowUnlocked ? 'auth (unlocked allowed)' : 'auth ON (locked)', allowUnlocked || ps.auth.enable_auth === true, `enable_auth=${ps.auth.enable_auth}`);
// ASR, turn
const kw: string[] = cc.asr.keywords ?? [];
check('asr keywords include Ilūkstes, Tirzes, Parauga', ['Ilūkstes', 'Tirzes', 'Parauga'].every((k) => kw.includes(k)), `${kw.length} keywords`);
eq('turn_eagerness', cc.turn.turn_eagerness, c.turn.turn_eagerness);
eq('turn_timeout', cc.turn.turn_timeout, c.turn.turn_timeout);
eq('speculative_turn', cc.turn.speculative_turn, c.turn.speculative_turn);
eq('spelling_patience', cc.turn.spelling_patience, c.turn.spelling_patience);
eq('soft-timeout seconds', cc.turn.soft_timeout_config?.timeout_seconds, c.turn.soft_timeout_seconds);
eq(`soft-timeout message = ${def}`, cc.turn.soft_timeout_config?.message, c.turn.soft_timeout_message?.[def]);
const langOverride = ps.overrides?.conversation_config_override?.agent?.language;
check('client cannot override the language (overrides.conversation_config_override.agent.language not true)', langOverride !== true, `got ${JSON.stringify(langOverride)}`);
// analysis
const dcWant = readJson(p('elevenlabs', 'analysis', 'data_collection.json')).map((d: any) => d.id).sort();
const evWant = readJson(p('elevenlabs', 'analysis', 'evaluation_criteria.json')).map((d: any) => d.id).sort();
eq('data_collection ids (16)', Object.keys(ps.data_collection ?? {}).sort(), dcWant);
eq('evaluation criteria ids (14)', (ps.evaluation?.criteria ?? []).map((x: any) => x.id).sort(), evWant);
// webhook (per-agent override; workspace-wide setting untouched)
const wh = ps.workspace_overrides?.webhooks;
check('per-agent post-call webhook override set', !!wh?.post_call_webhook_id && wh.post_call_webhook_id === state?.webhook_id, `id=${wh?.post_call_webhook_id}`);
const hooks = (await el('GET', '/v1/workspace/webhooks')).webhooks ?? [];
const h = hooks.find((x: any) => x.webhook_id === wh?.post_call_webhook_id);
check('webhook exists, URL = Worker /webhooks/elevenlabs, enabled', !!h && h.webhook_url === c.worker_url + c.post_call_webhook.path && !h.is_disabled, h ? `disabled=${h.is_disabled}` : 'missing');
check('webhook auth_type hmac', h?.auth_type === 'hmac', `auth_type=${h?.auth_type}`);
check('webhook omits the transcript (data minimisation)', wh?.exclude_transcript === true, '');
const st = await el('GET', '/v1/convai/settings');
eq('workspace-wide post_call_webhook_id untouched (null)', st.webhooks?.post_call_webhook_id ?? null, null);
// Worker side
const wr = spawnSync(process.execPath, [p('node_modules', 'wrangler', 'bin', 'wrangler.js'), 'secret', 'list', '--format', 'json'], { cwd: p('.'), env: process.env, encoding: 'utf8' });
let names: string[] = []; try { names = JSON.parse(wr.stdout).map((s: any) => s.name); } catch { /* ignore */ }
check('Worker secret ELEVENLABS_WEBHOOK_SECRET present', names.includes('ELEVENLABS_WEBHOOK_SECRET'), names.length ? '' : 'wrangler secret list failed');
const wj = readFileSync(p('wrangler.jsonc'), 'utf8');
check('wrangler.jsonc ELEVENLABS_AGENT_ID = this agent', new RegExp(`"ELEVENLABS_AGENT_ID"\\s*:\\s*"${id}"`).test(wj), '');
// tests exist
try { const tj = readJson(p('elevenlabs', 'tests.json')); check('tests.json has 27 specs + derived', Object.keys(tj.tests ?? {}).length >= 27, `${Object.keys(tj.tests ?? {}).length}`); } catch { check('tests.json present', false, 'missing'); }

let fail = 0;
for (const r of rows) { if (!r.ok) fail++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.detail}`); }
console.log(`\ncheck-agent ${id}: ${rows.length - fail}/${rows.length} PASS${fail ? `, ${fail} FAIL` : ''}`);
process.exit(fail ? 1 : 0);
