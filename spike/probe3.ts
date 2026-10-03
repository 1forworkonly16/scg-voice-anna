import { el } from './el.ts';
// can a library (not-added) voice be used in TTS? try Ilze with v3
const r:any = await el('POST','/v1/text-to-speech/4nP0MRk3S5Qj1fGfXf51?output_format=mp3_44100_64',{text:'Labdien.',model_id:'eleven_v3'},true);
console.log(r.status, (await r.text()).slice(0,200).replace(/[^\x20-\x7e]/g,'.'));
const s:any = await el('GET','/v1/user').catch(e=>String(e).slice(0,200));
console.log(JSON.stringify(s).slice(0,500));
