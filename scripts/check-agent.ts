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

const a = await el('GET', `/v1/convai/agents/${id}`);
const cc = a.conversation_config, ps = a.platform_settings, pr = cc.agent.prompt;
const state = readAgents().agents[c.name];
const toolsFile = readJson(p('elevenlabs', 'tools.json'));
const toolIds: string[] = Object.entries<any>(toolsFile.tools).filter(([n]) => !c.tools || c.tools.includes(n)).map(([, t]) => t.id); // allowlist from agent_config.json

// agent identity and model
eq('agent name', a.name, c.name);
eq('default language', cc.agent.language, c.agent.language);
eq('TTS model', cc.tts.model_id, c.tts.model_id);
eq('voice (Marina)', cc.tts.voice_id, 'ymDCYd8puC7gYjxIamPt');
eq('no per-language voice override (ONE voice for LV and RU)', cc.language_presets?.ru?.overrides?.tts?.voice_id ?? null, null);
eq('expressive_mode off (no audio tags)', cc.tts.expressive_mode, false);
check('LLM is one of the allowed Claude models', ['claude-haiku-4-5', 'claude-sonnet-5-5'].includes(pr.llm), `llm=${pr.llm}`);
eq('LLM matches agents.json', pr.llm, state?.llm);
// language presets
eq('ru preset language', cc.language_presets?.ru?.overrides?.agent?.language, 'ru');
check('ru preset first_message has AI + recording notice', /ИИ/.test(cc.language_presets?.ru?.overrides?.agent?.first_message ?? '') && /записывается/.test(cc.language_presets?.ru?.overrides?.agent?.first_message ?? ''));
check('ru preset carries no prompt override (the platform ignores it; probe 2026-10-03)', !cc.language_presets?.ru?.overrides?.agent?.prompt?.prompt, '');
check('lv first_message has AI + recording notice', /mākslīgā intelekta/.test(cc.agent.first_message) && /ierakst/.test(cc.agent.first_message));
// prompt in sync with the repo files
const expected = buildBody(state?.webhook_id ?? null, toolIds);
eq('prompt text in sync with elevenlabs/prompt/*', pr.prompt, expected.conversation_config.agent.prompt.prompt);
eq('ru preset first_message in sync', cc.language_presets?.ru?.overrides?.agent?.first_message, expected.conversation_config.language_presets.ru.overrides.agent.first_message);
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
eq('record_voice', ps.privacy.record_voice, true);
check(allowUnlocked ? 'auth (unlocked allowed)' : 'auth ON (locked)', allowUnlocked || ps.auth.enable_auth === true, `enable_auth=${ps.auth.enable_auth}`);
// ASR, turn
const kw: string[] = cc.asr.keywords ?? [];
check('asr keywords include Ilūkstes, Tirzes, Parauga', ['Ilūkstes', 'Tirzes', 'Parauga'].every((k) => kw.includes(k)), `${kw.length} keywords`);
eq('turn_eagerness', cc.turn.turn_eagerness, c.turn.turn_eagerness);
eq('turn_timeout', cc.turn.turn_timeout, c.turn.turn_timeout);
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
