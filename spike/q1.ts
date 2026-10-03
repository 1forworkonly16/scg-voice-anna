import { el } from './el.ts';
import { createAgent } from './agentcfg.ts';
import { writeFileSync } from 'node:fs';
const ILZE = '4nP0MRk3S5Qj1fGfXf51';
const out: any = {};
for (const tts of ['eleven_v3_conversational','eleven_v4_turbo']) {
  const name = `scg-spike-q1-${tts.replace('eleven_','')}`;
  try {
    const c = await createAgent({ name, llm: 'claude-sonnet-5-5', tts, voice: ILZE });
    const back = await el('GET', `/v1/convai/agents/${c.agent_id}`);
    out[tts] = { create_resp: c, readback: { language: back.conversation_config?.agent?.language, tts: back.conversation_config?.tts, presets: back.conversation_config?.language_presets, llm: back.conversation_config?.agent?.prompt?.llm, builtin: back.conversation_config?.agent?.prompt?.built_in_tools, version_id: back.version_id, branch_id: back.branch_id, main_branch_id: back.main_branch_id, top_keys: Object.keys(back) } };
  } catch (e: any) { out[tts] = { error: String(e).slice(0, 800) }; }
}
writeFileSync('spike/q1_lang_tts.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1).slice(0, 5000));
