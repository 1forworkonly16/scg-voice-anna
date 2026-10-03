import { el } from './el.ts';
import { createAgent } from './agentcfg.ts';
import { writeFileSync } from 'node:fs';
const ILZE = '4nP0MRk3S5Qj1fGfXf51'; const out: any = {};
// A: create lv agent with flash_v2_5 (no Latvian) -> kept, rejected, or silently changed?
for (const tts of ['eleven_flash_v2_5', 'eleven_multilingual_v2']) {
  try {
    const c = await createAgent({ name: `scg-spike-q1b-${tts}`, llm: 'claude-haiku-4-5', tts, voice: ILZE });
    const b = await el('GET', `/v1/convai/agents/${c.agent_id}`);
    out['create_lv_with_' + tts] = { agent_id: c.agent_id, language: b.conversation_config.agent.language, tts_model_after: b.conversation_config.tts.model_id };
  } catch (e: any) { out['create_lv_with_' + tts] = { error: String(e).slice(0, 500) }; }
}
// B: PATCH model on the v3 agent -> v4 turbo and back; confirm kept
const id = 'agent_7401m40a6hdjfa4vn78g1g76mdr8';
const r1 = await el('PATCH', `/v1/convai/agents/${id}`, { conversation_config: { tts: { model_id: 'eleven_v4_turbo' } } });
out.patch_v3_to_v4 = { after: (await el('GET', `/v1/convai/agents/${id}`)).conversation_config.tts.model_id, version_id: r1.version_id };
const r2 = await el('PATCH', `/v1/convai/agents/${id}`, { conversation_config: { tts: { model_id: 'eleven_v3_conversational' } } });
out.patch_back_v3 = { after: (await el('GET', `/v1/convai/agents/${id}`)).conversation_config.tts.model_id, version_id: r2.version_id };
// C: language lv with additional unsupported language code in presets? (skip) ; read language lists accepted: try bogus lang
try { await el('PATCH', `/v1/convai/agents/${id}`, { conversation_config: { agent: { language: 'xx' } } }); out.bogus_language = 'accepted?!'; } catch (e: any) { out.bogus_language = String(e).slice(0, 300); }
writeFileSync('spike/q1b_tts_fallback.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
// Q6: timezone in a real talk-to-link (react_sdk) conversation: read only dynamic_variables.system__timezone of the one pre-existing conversation
const c = await el('GET', '/v1/convai/conversations/conv_9401m3pkgdv5eajs0w2va51vw8sg');
console.log('talk-to(react_sdk) conv: source', c.metadata?.conversation_initiation_source, 'system__timezone=', JSON.stringify(c.conversation_initiation_client_data?.dynamic_variables?.system__timezone), 'metadata.timezone=', JSON.stringify(c.metadata?.timezone), 'system__time=', c.conversation_initiation_client_data?.dynamic_variables?.system__time);
