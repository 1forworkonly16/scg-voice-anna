import { el } from './el.ts';
import { PROMPT } from './agentcfg.ts';
const newPrompt = PROMPT.replace('in at most two short sentences', 'in ONE short sentence of at most 15 words');
for (const id of process.argv.slice(2)) { const r = await el('PATCH', `/v1/convai/agents/${id}`, { conversation_config: { agent: { prompt: { prompt: newPrompt } } } }); console.log(id, r.version_id); }
