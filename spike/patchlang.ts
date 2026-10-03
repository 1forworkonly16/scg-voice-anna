import { el } from './el.ts';
for (const id of process.argv.slice(3)) { const r = await el('PATCH', `/v1/convai/agents/${id}`, { conversation_config: { agent: { language: process.argv[2] } } }); const b = await el('GET', `/v1/convai/agents/${id}`); console.log(id, r.version_id, b.conversation_config.agent.language, b.conversation_config.tts.model_id); }
