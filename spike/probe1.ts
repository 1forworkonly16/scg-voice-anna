import { el } from './el.ts';
const u = await el('GET','/v1/user/subscription').catch(e=>({err:String(e)}));
console.log(JSON.stringify({tier:u.tier, used:u.character_count, limit:u.character_limit, status:u.status, keys:Object.keys(u)}));
const a = await el('GET','/v1/convai/agents?page_size=50').catch(e=>({err:String(e)}));
console.log(JSON.stringify(a).slice(0,1500));
const c = await el('GET','/v1/convai/conversations?page_size=5').catch(e=>({err:String(e)}));
console.log(JSON.stringify(c).slice(0,800));
