// Builds / updates the ElevenLabs agent «scg-anna» from config (idempotent: PATCH when the agent exists, create otherwise).
//   node scripts/build-agent.ts [--llm claude-sonnet-5-5] [--no-webhook] [--rotate-webhook] [--dry]
// Inputs: elevenlabs/agent_config.json, elevenlabs/prompt/*, elevenlabs/analysis/*, elevenlabs/tools.json (run gen-tools first).
// Post-call webhook: a workspace webhook (HMAC) attached to THIS agent only via platform_settings.workspace_overrides.webhooks;
// the workspace-wide setting (post_call_webhook_id) is never touched. Its secret goes to the Worker via stdin (ELEVENLABS_WEBHOOK_SECRET)
// and the Windows user env; it is never printed or written to a file.
// The agent is left with auth ON (locked); use `npm run link:unlock` before a talk-to call.
import { el } from './el/api.ts';
import { cfg, p, persistUserEnv, putWorkerSecret, readAgents, readJson, readText, writeJson } from './el/common.ts';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const c = cfg();
const llm = opt('--llm') ?? c.agent.llm;

export function buildBody(webhookId: string | null, toolIds: string[]) {
  const base = readText(p('elevenlabs', 'prompt', 'system_prompt.md')).trim();
  const presets = readJson(p('elevenlabs', 'prompt', 'presets.json'));
  const toolDesc = readJson(p('elevenlabs', 'prompt', 'tool_descriptions.json'));
  const data = readJson(p('elevenlabs', 'analysis', 'data_collection.json')) as any[];
  const crit = readJson(p('elevenlabs', 'analysis', 'evaluation_criteria.json')) as any[];
  const first = readText(p('elevenlabs', 'prompt', 'first_message.md')).trim();
  if (first !== presets.lv.first_message.trim()) throw new Error('first_message.md differs from presets.json lv.first_message');
  const prompt = (lang: 'lv' | 'ru') => `${base}\n\n${presets[lang].prompt_addendum}`;
  const builtIn: Record<string, any> = {};
  for (const t of c.system_tools as string[]) builtIn[t] = { type: 'system', name: t, description: toolDesc[t] ?? '', params: { system_tool_type: t } };
  const turn = c.turn;
  const dc: Record<string, any> = {};
  for (const d of data) dc[d.id] = { type: d.type, description: d.description };
  const ps: any = {
    auth: { enable_auth: c.auth.enable_auth },
    call_limits: c.call_limits,
    privacy: { record_voice: c.privacy.record_voice, retention_days: c.privacy.retention_days },
    data_collection: dc,
    evaluation: { criteria: crit.map((x) => ({ id: x.id, name: x.name, type: 'prompt', conversation_goal_prompt: x.prompt })) },
  };
  if (webhookId) ps.workspace_overrides = { webhooks: { post_call_webhook_id: webhookId, events: ['transcript'], transcript_format: 'json', exclude_transcript: true } };
  return {
    name: c.name,
    tags: c.tags,
    conversation_config: {
      agent: {
        language: c.agent.language,
        first_message: first,
        disable_first_message_interruptions: c.agent.disable_first_message_interruptions,
        max_conversation_duration_message: c.agent.max_duration_message.lv,
        prompt: { prompt: base, llm, temperature: c.agent.temperature, ...(c.agent.reasoning_effort ? { reasoning_effort: c.agent.reasoning_effort } : {}), tool_ids: toolIds, built_in_tools: builtIn },
      },
      asr: { keywords: c.asr.keywords },
      tts: { model_id: c.tts.model_id, voice_id: c.tts.voice_id, expressive_mode: c.tts.expressive_mode, stability: c.tts.stability, speed: c.tts.speed, similarity_boost: c.tts.similarity_boost, text_normalisation_type: c.tts.text_normalisation_type },
      turn: {
        turn_eagerness: turn.turn_eagerness, turn_timeout: turn.turn_timeout, silence_end_call_timeout: turn.silence_end_call_timeout,
        spelling_patience: turn.spelling_patience, speculative_turn: turn.speculative_turn,
        soft_timeout_config: { timeout_seconds: turn.soft_timeout_seconds, message: turn.soft_timeout_message.lv },
      },
      conversation: { max_duration_seconds: c.conversation.max_duration_seconds },
      language_presets: {
        ru: { overrides: {
          agent: { language: 'ru', first_message: presets.ru.first_message, max_conversation_duration_message: c.agent.max_duration_message.ru },
          turn: { soft_timeout_config: { message: turn.soft_timeout_message.ru } },
        } },
      },
    },
    platform_settings: ps,
  };
}

async function findAgentByName(name: string): Promise<string | null> {
  const l = await el('GET', '/v1/convai/agents?page_size=100&search=' + encodeURIComponent(name));
  const hit = (l.agents ?? []).find((a: any) => a.name === name);
  return hit?.agent_id ?? null;
}

async function ensureWebhook(state: any): Promise<string> {
  const url = c.worker_url + c.post_call_webhook.path;
  const list = (await el('GET', '/v1/workspace/webhooks')).webhooks ?? [];
  const known = state.webhook_id as string | undefined;
  const existing = list.find((w: any) => w.webhook_id === known) ?? list.find((w: any) => w.name === c.post_call_webhook.name);
  if (existing && !flag('--rotate-webhook')) return existing.webhook_id;
  if (existing) await el('DELETE', `/v1/workspace/webhooks/${existing.webhook_id}`);
  const r = await el('POST', '/v1/workspace/webhooks', { settings: { auth_type: 'hmac', name: c.post_call_webhook.name, webhook_url: url } });
  const secret = String(r.webhook_secret ?? '').trim();
  if (!secret) throw new Error('webhook created but no secret was returned; re-run with --rotate-webhook');
  try { putWorkerSecret('ELEVENLABS_WEBHOOK_SECRET', secret); } catch (e) { throw new Error(`webhook ${r.webhook_id} created but the Worker secret could not be set (${(e as Error).message}); re-run with --rotate-webhook`); }
  const persisted = persistUserEnv('ELEVENLABS_WEBHOOK_SECRET', secret);
  console.log(`webhook ${r.webhook_id} created; ELEVENLABS_WEBHOOK_SECRET set on the Worker (value not shown); user env ${persisted ? 'updated' : 'NOT updated'}`);
  return r.webhook_id;
}

if (import.meta.main) {
  const tools = readJson(p('elevenlabs', 'tools.json')).tools as Record<string, { id: string | null }>;
  const toolIds = Object.values(tools).map((t) => t.id).filter((x): x is string => !!x);
  if (toolIds.length !== Object.keys(tools).length) throw new Error('tools.json has no ids: run `node scripts/gen-tools.ts` first');
  const state = readAgents();
  const cur = state.agents[c.name] ?? {};
  if (flag('--dry')) { console.log(JSON.stringify(buildBody(null, toolIds)).length, 'bytes (dry)'); process.exit(0); }
  const webhookId = flag('--no-webhook') ? null : await ensureWebhook(cur);
  const body = buildBody(webhookId, toolIds);
  let id: string | null = cur.agent_id ?? (await findAgentByName(c.name));
  if (id) { await el('PATCH', `/v1/convai/agents/${id}`, body); console.log(`agent ${id} updated (llm ${llm})`); }
  else { const r = await el('POST', '/v1/convai/agents/create', body); id = r.agent_id as string; console.log(`agent ${id} created (llm ${llm})`); }
  state.agents[c.name] = { agent_id: id, webhook_id: webhookId ?? cur.webhook_id ?? null, llm, updated: new Date().toISOString() };
  writeJson(p('elevenlabs', 'agents.json'), { _note: 'GENERATED by scripts/build-agent.ts. Ids only, no secrets.', ...state });
}
