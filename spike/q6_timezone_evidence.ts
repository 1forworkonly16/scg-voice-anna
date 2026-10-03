// Read-only: saves ONLY the timezone-related fields of two conversations (no names, no transcript).
import { el } from './el.ts';
import { writeFileSync } from 'node:fs';
const out: any = {};
for (const [label, id] of [['talk_to_link_react_sdk (pre-existing, other agent)', 'conv_9401m3pkgdv5eajs0w2va51vw8sg']]) {
  const c = await el('GET', `/v1/convai/conversations/${id}`);
  const dv = c.conversation_initiation_client_data?.dynamic_variables ?? {};
  out[label] = { conversation_id: id, source: c.metadata?.conversation_initiation_source, 'metadata.timezone': c.metadata?.timezone, 'system__timezone': dv.system__timezone ?? null, 'system__time': dv.system__time, 'system__time_utc_present': !!dv.system__time_utc };
}
// raw websocket evidence: spike/conv_langswitch_v3_B.json (saved before the spike agents were deleted)
const rw = JSON.parse((await import('node:fs')).readFileSync('spike/conv_langswitch_v3_B.json', 'utf8'));
const rdv = rw.conversation_initiation_client_data?.dynamic_variables ?? {};
out['raw_websocket (spike run langswitch_v3_B, from saved file)'] = { conversation_id: rw.conversation_id, 'metadata.timezone': rw.metadata?.timezone, system__timezone: rdv.system__timezone ?? null, system__time: rdv.system__time, system__time_utc_present: !!rdv.system__time_utc };
writeFileSync('spike/q6_timezone_evidence.json', JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
