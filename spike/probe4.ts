import { el } from './el.ts';
import { writeFileSync } from 'node:fs';
const m = await el('GET','/v1/models');
writeFileSync('spike/models.json', JSON.stringify(m.map((x:any)=>({id:x.model_id,name:x.name,tts:x.can_do_text_to_speech,langs:(x.languages||[]).map((l:any)=>l.language_id).join(',')})),null,1));
for (const x of m) console.log(x.model_id, '|', x.can_do_text_to_speech, '| lv:', (x.languages||[]).some((l:any)=>l.language_id==='lv'), '| ru:',(x.languages||[]).some((l:any)=>l.language_id==='ru'), '| n=',(x.languages||[]).length);
