import { readFileSync, writeFileSync } from 'node:fs';
const out: any = {};
for (const f of ['v3_lv_price','v4t_lv_price','v3_ru_price','v4t_ru_price','v3_lv_floors','v4t_lv_phone']) {
  const lang = f.includes('_ru_') ? 'ru' : 'lv';
  const buf = readFileSync(`spike/samples/q3/${f}.mp3`);
  const fd = new FormData(); fd.append('model_id','scribe_v1'); fd.append('language_code',lang); fd.append('timestamps_granularity','word'); fd.append('file', new Blob([buf],{type:'audio/mpeg'}),'a.mp3');
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY!},body:fd});
  const j:any = await r.json();
  out[f] = (j.words||[]).filter((w:any)=>w.type==='word').map((w:any)=>`${w.text}[${(w.end-w.start).toFixed(2)}s]`).join(' ');
  console.log(f, '|', out[f]);
}
writeFileSync('spike/q3b_word_timing.json', JSON.stringify(out,null,1));
