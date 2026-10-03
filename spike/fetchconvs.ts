import { el } from './el.ts';
import { writeFileSync } from 'node:fs';
const strip = (o: any): any => Array.isArray(o) ? o.map(strip) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([k]) => !/audio_base|^audio$/i.test(k)).map(([k, v]) => [k, strip(v)])) : o;
for (const p of process.argv.slice(2)) { const [id, label] = p.split(':'); const c = await el('GET', `/v1/convai/conversations/${id}`); writeFileSync(`spike/conv_${label}.json`, JSON.stringify(strip(c), null, 1)); console.log(label, c.status); }
