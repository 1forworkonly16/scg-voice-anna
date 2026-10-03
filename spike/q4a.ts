import { el } from './el.ts';
import { PROMPT } from './agentcfg.ts';
import { readFileSync, writeFileSync } from 'node:fs';
const id = JSON.parse(readFileSync('spike/q1_lang_tts.json','utf8')).eleven_v3_conversational.create_resp.agent_id;
const out: any = { agent: id };
const g = async () => { const a = await el('GET', `/v1/convai/agents/${id}`); return { version_id: a.version_id, branch_id: a.branch_id, main_branch_id: a.main_branch_id, prompt_len: a.conversation_config.agent.prompt.prompt.length }; };
out.before = await g();
for (const p of [`/v1/convai/agents/${id}/branches`, `/v1/convai/agents/${id}/versions`, `/v1/convai/agents/${id}/branches/${out.before.main_branch_id}`]) {
  try { const r = await el('GET', p); out['GET ' + p.replace(id, '<id>')] = JSON.stringify(r).slice(0, 1200); } catch (e: any) { out['GET ' + p.replace(id, '<id>')] = String(e).slice(0, 300); }
}
const newPrompt = PROMPT.replace('in at most two short sentences', 'in ONE short sentence of at most 15 words');
const resp = await el('PATCH', `/v1/convai/agents/${id}`, { conversation_config: { agent: { prompt: { prompt: newPrompt } } } });
out.patch_resp_keys = Object.keys(resp); out.patch_resp_ids = { version_id: resp.version_id, branch_id: resp.branch_id, main_branch_id: resp.main_branch_id };
out.after = await g();
writeFileSync('spike/q4a_versioning.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
