import { el } from './el.ts';
import { writeFileSync } from 'node:fs';
// my voices
const v = await el('GET','/v2/voices?page_size=100');
writeFileSync('spike/voices_account.json', JSON.stringify(v.voices.map((x:any)=>({id:x.voice_id,name:x.name,cat:x.category,labels:x.labels,verified_langs:(x.verified_languages||[]).map((l:any)=>l.language+':'+l.model_id)})),null,1));
console.log('account voices', v.voices.length);
// shared library, Latvian + female
for (const lang of ['lv','ru']) {
  const s = await el('GET',`/v1/shared-voices?page_size=30&language=${lang}&gender=female&sort=usage_character_count_1y`);
  writeFileSync(`spike/voices_shared_${lang}.json`, JSON.stringify(s.voices.map((x:any)=>({id:x.voice_id,pub:x.public_owner_id,name:x.name,gender:x.gender,age:x.age,accent:x.accent,descr:x.description?.slice(0,80),use:x.use_case,langs:(x.verified_languages||[]).map((l:any)=>l.language+':'+l.model_id+':'+(l.accent||'')),usage7d:x.usage_character_count_1y,free:x.free_users_allowed,notice:x.notice_period})),null,1));
  console.log(lang, s.voices.length);
}
