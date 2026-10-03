// Locks / unlocks the talk-to link of the agent «scg-anna» (platform_settings.auth.enable_auth) and prints the URL.
//   npm run link:unlock    auth OFF: anyone with the link can start a call (burns voice minutes)
//   npm run link:lock      auth ON: the link is dead (websocket closes with code 3000)
//   node scripts/link.ts status
// One PATCH each (it creates a new agent version; there is no separate publish step).
import { el } from './el/api.ts';
import { agentId, cfg, TALK_TO } from './el/common.ts';

const mode = process.argv[2];
if (!['unlock', 'lock', 'status'].includes(mode ?? '')) { console.error('usage: node scripts/link.ts unlock|lock|status'); process.exit(2); }
const id = agentId(cfg().name);
if (mode !== 'status') await el('PATCH', `/v1/convai/agents/${id}`, { platform_settings: { auth: { enable_auth: mode === 'lock' } } });
const a = await el('GET', `/v1/convai/agents/${id}`);
const locked = a.platform_settings.auth.enable_auth === true;
console.log(`agent ${id}: auth ${locked ? 'ON (LOCKED, the link does not work)' : 'OFF (UNLOCKED, the link is live)'}`);
console.log(`talk-to link: ${TALK_TO(id)}`);
if (!locked) console.log('REMINDER: run `npm run link:lock` when done.');
