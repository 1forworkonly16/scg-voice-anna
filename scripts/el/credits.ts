// ElevenLabs credit balance (GET /v1/user/subscription): remaining = character_limit - character_count. Never prints the key.
//   npm run el:credits                       prints limit, used, remaining
//   npm run el:credits -- --before N --min M prints the credits per minute since a balance N over M minutes of talk
// The balance lags a call or test run by about 1 minute.
import { el } from './api.ts';

const args = process.argv.slice(2);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : NaN; };
const s = await el('GET', '/v1/user/subscription');
const limit = Number(s.character_limit), used = Number(s.character_count), remaining = limit - used;
console.log(`credits: limit ${limit}, used ${used}, remaining ${remaining}`);
const before = opt('--before'), min = opt('--min');
if (Number.isFinite(before) && Number.isFinite(min) && min > 0) {
  const spent = before - remaining;
  console.log(`spent ${spent} over ${min} min = ${Math.round(spent / min)} credits/min`);
}
if (remaining < 8000) console.log('STOP: remaining < 8,000. Stop testing; keep the rest for the meeting');
