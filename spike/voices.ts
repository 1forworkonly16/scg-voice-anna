import { el } from './el.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
import { LV_FIRST, RU_FIRST } from './agentcfg.ts';
const MODEL = 'eleven_v4_turbo';
const V: [string,string,string][] = [
 ['Ilze','4nP0MRk3S5Qj1fGfXf51','lv-lib'], ['Signe','6H9DAoiqXpVkBN5eOmIS','lv-lib'], ['Elza','Xi5LaSIxpOwjOzRqTEG1','lv-lib'], ['Baiba','azBQdzUwIzEtXS9PGiGX','lv-lib'],
 ['Marina-ru','ymDCYd8puC7gYjxIamPt','ru-acct'], ['Kate-ru','tOo2BJ74frmnPadsDNIi','ru-acct'], ['Rina-ru','ycbyWsnf4hqZgdpKHqiU','ru-acct'],
 ['Alice-premade','Xb7hH8MSUJpSbSDYk0k2','premade'], ['Sarah-premade','EXAVITQu4vr4xnSDxMaL','premade'],
];
const TEXTS: Record<string,[string,string]> = { lv:['lv',LV_FIRST.replace(' Можно по-русски.','')], ru:['ru',RU_FIRST], bi:['',LV_FIRST] };
mkdirSync('spike/samples/voices',{recursive:true});
const norm=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu,' ').split(/\s+/).filter(Boolean);
const sim=(a:string,b:string)=>{const A=norm(a),B=new Set(norm(b));return +(A.filter(w=>B.has(w)).length/Math.max(1,A.length)).toFixed(2)};
const out:any[]=[];
for (const [name,id,kind] of V) for (const [tk,[lang,text]] of Object.entries(TEXTS)) {
  // LV-only voices skip nothing: we test all combos to learn bilingual ability
  const t0=performance.now();
  const r:any = await el('POST',`/v1/text-to-speech/${id}?output_format=mp3_44100_64`,{text,model_id:MODEL},true);
  if(!r.ok){out.push({name,tk,error:r.status+' '+(await r.text()).slice(0,200)});console.log(name,tk,'ERR',r.status);continue;}
  const buf=Buffer.from(await r.arrayBuffer()); const ms=Math.round(performance.now()-t0);
  writeFileSync(`spike/samples/voices/${name}_${tk}.mp3`,buf);
  const fd=new FormData(); fd.append('model_id','scribe_v1'); if(lang) fd.append('language_code',lang); fd.append('file',new Blob([buf],{type:'audio/mpeg'}),'a.mp3');
  const s:any=await (await fetch('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY!},body:fd})).json();
  const expect = tk==='bi'? text : text;
  out.push({name,id,kind,tk,ms,sec:+(buf.length*8/64000).toFixed(1),sim:sim(s.text||'',expect),stt:s.text});
  console.log(name.padEnd(14),tk,ms,'sim',sim(s.text||'',expect),'|',(s.text||'').slice(0,150));
}
writeFileSync('spike/voices_samples.json',JSON.stringify(out,null,1));
