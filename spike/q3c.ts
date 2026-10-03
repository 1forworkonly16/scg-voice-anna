import { el } from './el.ts';
import { writeFileSync } from 'node:fs';
const ILZE = '4nP0MRk3S5Qj1fGfXf51';
const T = [
 ['lv','Orientējoši 90 320 eiro bez PVN, aptuveni 109 287 eiro ar PVN 21 procentu apmērā.', ['90 320','109 287']],
 ['lv','Divas iespējas: 5742 eiro vai 6542 eiro.', ['5742','6542']],
 ['ru','Ориентировочно 90 320 евро без НДС, около 109 287 евро с НДС.', ['90 320','109 287']],
];
const out: any[] = [];
for (const model of ['eleven_v3','eleven_v4_turbo']) for (const [lang,text,need] of T as any) for (let i=0;i<3;i++) {
  const r:any = await el('POST',`/v1/text-to-speech/${ILZE}?output_format=mp3_44100_64`,{text,model_id:model},true);
  const buf = Buffer.from(await r.arrayBuffer());
  const fd = new FormData(); fd.append('model_id','scribe_v1'); fd.append('language_code',lang); fd.append('file',new Blob([buf],{type:'audio/mpeg'}),'a.mp3');
  const s:any = await (await fetch('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY!},body:fd})).json();
  const norm = (s.text||'').replace(/ /g,' ');
  const ok = need.every((n:string)=>norm.includes(n)||norm.includes(n.replace(' ','')));
  out.push({model,lang,text:text.slice(0,40),rep:i,stt:norm,ok}); console.log(model.padEnd(16),lang,i,ok?'OK  ':'FAIL',norm);
}
writeFileSync('spike/q3c_number_repeats.json',JSON.stringify(out,null,1));
const sum:any={}; for(const o of out){const k=o.model; sum[k]=sum[k]||{ok:0,n:0}; sum[k].n++; if(o.ok)sum[k].ok++;} console.log(JSON.stringify(sum));
