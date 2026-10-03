import { readFileSync, writeFileSync } from 'node:fs';
const out: any = {};
for (const f of ['langswitch_v4.agent.t1', 'langswitch_v3_B.agent.t1', 'langswitch_v4.agent.t2', 'langswitch_v4.agent.t3', 'langswitch_v3_B.agent.t3']) {
  const fd = new FormData(); fd.append('model_id', 'scribe_v1'); fd.append('tag_audio_events', 'true'); fd.append('file', new Blob([readFileSync(`spike/samples/${f}.wav`)], { type: 'audio/wav' }), 'a.wav');
  const s: any = await (await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! }, body: fd })).json();
  out[f] = { lang: s.language_code, text: s.text }; console.log(f, '|', s.language_code, '|', s.text);
}
writeFileSync('spike/q_agent_audio_stt.json', JSON.stringify(out, null, 1));
