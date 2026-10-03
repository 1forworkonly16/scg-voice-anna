import { el } from './el.ts';
import { writeFileSync } from 'node:fs';
const since = Math.floor(Date.parse('2026-10-03T00:00:00Z') / 1000);
const l: any = await el('GET', `/v1/convai/conversations?page_size=100&call_start_after_unix=${since}`);
const rows: any = {};
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)].toFixed(2) : null; };
for (const c of l.conversations.filter((c: any) => c.agent_name.startsWith('scg-spike-lat-'))) {
  const d: any = await el('GET', `/v1/convai/conversations/${c.conversation_id}`);
  const lang = (d.transcript.find((t: any) => t.role === 'user')?.message || '').match(/[а-я]/i) ? 'ru' : 'lv';
  const k = c.agent_name.replace('scg-spike-lat-', '') + '|' + lang;
  rows[k] ??= { convs: [], ttfa: [], llm_ttfb: [], turn_wait: [], tts_ttfb: [], secs: 0, llm: 0, fiat: 0, voice: 0 };
  const r = rows[k]; r.convs.push(c.conversation_id); r.secs += d.metadata.call_duration_secs; r.llm += d.metadata.charging.llm_price; r.fiat += d.metadata.cost_fiat; r.voice += d.metadata.charging.platform_price;
  for (const t of d.transcript) { const m = t.conversation_turn_metrics?.metrics; if (t.role !== 'agent' || !m?.convai_ttf_audio_since_silence) continue;
    r.ttfa.push(m.convai_ttf_audio_since_silence.elapsed_time); r.llm_ttfb.push(m.convai_llm_service_ttfb?.elapsed_time ?? NaN); r.turn_wait.push(m.convai_turn_silence_before_initiation?.elapsed_time ?? NaN); r.tts_ttfb.push(m.convai_tts_service_ttfb?.elapsed_time ?? NaN); }
}
const out: any = {};
for (const [k, r] of Object.entries<any>(rows)) out[k] = { n_convs: r.convs.length, n_turns: r.ttfa.length, ttfa_p50: pct(r.ttfa, .5), ttfa_p90: pct(r.ttfa, .9), llm_ttfb_p50: pct(r.llm_ttfb.filter((x: number) => !isNaN(x)), .5), turn_wait_p50: pct(r.turn_wait.filter((x: number) => !isNaN(x)), .5), tts_ttfb_p50: pct(r.tts_ttfb.filter((x: number) => !isNaN(x)), .5), minutes: +(r.secs / 60).toFixed(2), llm_usd: +r.llm.toFixed(4), llm_usd_per_min: +(r.llm / (r.secs / 60)).toFixed(4), voice_usd_per_min: +(r.voice / (r.secs / 60)).toFixed(4), total_usd_per_min: +(r.fiat / (r.secs / 60)).toFixed(4), ttfa_all: r.ttfa.map((x: number) => +x.toFixed(2)), convs: r.convs };
writeFileSync('spike/q5_server_metrics.json', JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries<any>(out)) console.log(k.padEnd(12), JSON.stringify({ ...v, convs: undefined, ttfa_all: undefined }));
