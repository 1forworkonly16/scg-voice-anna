import { el } from './el.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
const ILZE = '4nP0MRk3S5Qj1fGfXf51';
const texts: Record<string,{lang:string,text:string}> = {
  lv_price: { lang: 'lv', text: 'Orientējoši 90 320 eiro bez PVN, aptuveni 109 287 eiro ar PVN 21 procentu apmērā.' },
  lv_date:  { lang: 'lv', text: 'Bezmaksas apskate varētu notikt 2026. gada 14. oktobrī plkst. 10:30.' },
  lv_floors:{ lang: 'lv', text: 'Ēkā ir 9 stāvi un 4 kāpņu telpas, Ilūkstes ielā 12, dzīvoklis 37.' },
  lv_phone: { lang: 'lv', text: 'Tālrunis 22 84 81 44, darba laiks no pirmdienas līdz piektdienai, no 9:00 līdz 17:00.' },
  lv_small: { lang: 'lv', text: 'Divas iespējas: 5742 eiro vai 6542 eiro, kopā ar 3 pagrabiem un 1 kāpņu telpu.' },
  ru_price: { lang: 'ru', text: 'Ориентировочно 90 320 евро без НДС, около 109 287 евро с НДС 21 процент.' },
  ru_date:  { lang: 'ru', text: 'Бесплатный осмотр может пройти 14 октября 2026 года в 10:30.' },
  ru_floors:{ lang: 'ru', text: 'В доме 9 этажей и 4 лестничные клетки, Ilūkstes iela 12, квартира 37.' },
};
const variants = [ ['v3','eleven_v3','auto'], ['v4t','eleven_v4_turbo','auto'], ['v4t_normON','eleven_v4_turbo','on'] ];
mkdirSync('spike/samples/q3', { recursive: true });
const out: any = { texts, results: [] };
for (const [vn, model, norm] of variants) for (const [k, t] of Object.entries(texts)) {
  const body: any = { text: t.text, model_id: model, apply_text_normalization: norm };
  const t0 = performance.now();
  const r: any = await el('POST', `/v1/text-to-speech/${ILZE}?output_format=mp3_44100_64`, body, true);
  if (!r.ok) { out.results.push({ vn, k, error: r.status + ' ' + (await r.text()).slice(0, 300) }); continue; }
  const buf = Buffer.from(await r.arrayBuffer()); const dt = Math.round(performance.now() - t0);
  const f = `spike/samples/q3/${vn}_${k}.mp3`; writeFileSync(f, buf);
  // STT back
  const fd = new FormData(); fd.append('model_id', 'scribe_v1'); fd.append('language_code', t.lang); fd.append('file', new Blob([buf], { type: 'audio/mpeg' }), 'a.mp3');
  const s = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! }, body: fd });
  const sj: any = await s.json().catch(() => ({}));
  out.results.push({ vn, k, ms: dt, bytes: buf.length, stt: s.ok ? sj.text : `STT ${s.status} ${JSON.stringify(sj).slice(0, 200)}` });
}
writeFileSync('spike/q3_numbers_dates.json', JSON.stringify(out, null, 1));
for (const r of out.results) console.log(r.vn.padEnd(11), r.k.padEnd(9), r.ms ?? '', '|', r.stt ?? r.error);
