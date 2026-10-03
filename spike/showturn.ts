import { el } from './el.ts';
const a = await el('GET', `/v1/convai/agents/${process.argv[2]}`);
console.log(JSON.stringify(a.conversation_config.turn)); console.log(JSON.stringify(a.conversation_config.asr)); console.log(JSON.stringify(a.platform_settings.auth)); console.log(JSON.stringify(a.conversation_config.conversation));
