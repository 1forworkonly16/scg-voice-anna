import { el } from './el.ts';
import { writeFileSync } from 'node:fs';
// usage: node spike/conv.ts <conversation_id> <label>
const id = process.argv[2], label = process.argv[3] ?? id;
let c: any;
for (let i = 0; i < 6; i++) { c = await el('GET', `/v1/convai/conversations/${id}`); if (c.status === 'done' || c.status === 'failed') break; await new Promise(r => setTimeout(r, 4000)); }
// redact: drop big/audio fields
const strip = (o: any): any => Array.isArray(o) ? o.map(strip) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([k]) => !/audio_base|^audio$/i.test(k)).map(([k, v]) => [k, strip(v)])) : o;
writeFileSync(`spike/conv_${label}.json`, JSON.stringify(strip(c), null, 1));
console.log(JSON.stringify({ status: c.status, version_id: c.version_id, branch_id: c.branch_id, metadata_keys: Object.keys(c.metadata ?? {}), metadata: strip(c.metadata) }, null, 1).slice(0, 3500));
