import { createAgent } from './agentcfg.ts';
import { writeFileSync } from 'node:fs';
const ILZE = '4nP0MRk3S5Qj1fGfXf51'; const out:any={};
for (const llm of ['claude-opus-5-5','claude-sonnet-5-5','claude-haiku-4-5']) {
  const r = await createAgent({ name: `scg-spike-lat-${llm.replace('claude-','')}`, llm, tts: 'eleven_v4_turbo', voice: ILZE, first: '' });
  out[llm] = r; console.log(llm, r.agent_id);
}
writeFileSync('spike/lat_agents.json', JSON.stringify(out,null,1));
