import { readFileSync } from 'node:fs';
const c = JSON.parse(readFileSync(`spike/conv_${process.argv[2]}.json`, 'utf8')); const m = c.metadata, ch = m.charging;
console.log(JSON.stringify({ ver: c.version_id, dur: m.call_duration_secs, credits: m.cost, fiat: m.cost_fiat, llm_price: ch.llm_price, voice_price: ch.platform_price, tts: ch.tts_usage?.primary_tts_model, tts_s: ch.tts_usage?.total_audio_output_seconds, tz: m.timezone, lang: m.main_language }));
for (const t of c.transcript) { const mm = t.conversation_turn_metrics?.metrics; if (!mm) continue; console.log(t.role, (t.message||'').slice(0,40).replace(/\n/g,' '), JSON.stringify(Object.fromEntries(Object.entries(mm).map(([k, v]: any) => [k.replace('convai_',''), +v.elapsed_time.toFixed(2)])))); }
