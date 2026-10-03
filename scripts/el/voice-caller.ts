// Synthetic caller for ElevenLabs Agents (WP4 spike tool; Node 24 native TS, no deps).
// Usage (keys loaded by scripts/env.ps1):
//   node scripts/el/voice-caller.ts --agent <agent_id> --turns spike/turns/x.json --out <label>
//        [--caller-voice <voice_id>] [--caller-model eleven_v3] [--auth signed|public] [--max-wait 25] [--no-greeting 1]
// turns.json: [{"text":"...","lang":"lv|ru","note":"...","voice":"<caller voice id, optional>"}]
// Writes: spike/samples/<label>.agent.wav (+ per-turn), spike/samples/<label>.caller.wav,
//         spike/<label>.log.json (redacted: no audio, no key).
// Latency = end of caller SPEECH audio (before padding silence) -> first agent audio chunk received.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error('ELEVENLABS_API_KEY missing');
const agentId = args.get('agent')!;
const label = args.get('out') ?? 'call';
const turns: { text: string; lang?: string; note?: string; voice?: string }[] = JSON.parse(readFileSync(args.get('turns')!, 'utf8'));
const callerVoice = args.get('caller-voice') ?? 'onwK4e9ZLuTAKqWW03F9'; // Daniel (premade, multilingual)
const callerModel = args.get('caller-model') ?? 'eleven_v3';
const maxWaitS = Number(args.get('max-wait') ?? 25);
const SR = 16000, CHUNK_MS = 100, CHUNK_BYTES = (SR * 2 * CHUNK_MS) / 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function wav(pcm: Buffer, sr = SR): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function tts(text: string, voice = callerVoice): Promise<Buffer> {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=pcm_16000`, {
    method: 'POST', headers: { 'xi-api-key': KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: callerModel }),
  });
  if (!r.ok) throw new Error(`caller TTS ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

async function wsUrl(): Promise<string> {
  if (args.get('auth') === 'signed') {
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`, { headers: { 'xi-api-key': KEY! } });
    if (!r.ok) throw new Error(`signed url ${r.status}`);
    return (await r.json()).signed_url;
  }
  return `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`;
}

mkdirSync('spike/samples', { recursive: true });
const callerPcm: Buffer[] = [];
for (const t of turns) callerPcm.push(await tts(t.text, t.voice));
writeFileSync(`spike/samples/${label}.caller.wav`, wav(Buffer.concat(callerPcm)));

const t0 = performance.now();
const now = () => Math.round(performance.now() - t0);
const events: any[] = [];
const speechQueue: Buffer[] = [];
let speaking = false;               // caller speech in progress
let agentChunks: { t: number; pcm: Buffer; turn: number }[] = [];
let curTurn = -1;                   // -1 = greeting
let lastAudioAt = 0, playEnd = 0, firstAudioAt: number | null = null, convId = '', meta: any = {};
let closed = false;

const ws = new WebSocket(await wsUrl());
const opened = new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = (e: any) => rej(new Error('ws error ' + (e?.message ?? ''))); });
ws.onclose = (e: any) => { closed = true; events.push({ t: now(), type: 'ws_close', code: e.code, reason: String(e.reason ?? '').slice(0, 200) }); };
ws.onmessage = (m: any) => {
  const d = JSON.parse(String(m.data));
  const ty = d.type;
  if (ty === 'ping') { ws.send(JSON.stringify({ type: 'pong', event_id: d.ping_event.event_id })); return; }
  if (ty === 'audio') {
    const pcm = Buffer.from(d.audio_event.audio_base_64, 'base64');
    const t = now();
    if (firstAudioAt === null) firstAudioAt = t;
    agentChunks.push({ t, pcm, turn: curTurn });
    lastAudioAt = t;
    playEnd = Math.max(playEnd, t) + (pcm.length / 2 / SR) * 1000;
    return;
  }
  if (ty === 'conversation_initiation_metadata') { meta = d.conversation_initiation_metadata_event; convId = meta.conversation_id; }
  const ev: any = { t: now(), type: ty, turn: curTurn };
  if (d.user_transcription_event) ev.user_transcript = d.user_transcription_event.user_transcript;
  if (d.agent_response_event) ev.agent_response = d.agent_response_event.agent_response;
  if (d.agent_response_correction_event) ev.correction = d.agent_response_correction_event;
  if (d.interruption_event) ev.interruption = d.interruption_event;
  if (ty === 'conversation_initiation_metadata') ev.meta = d.conversation_initiation_metadata_event;
  if (!ev.user_transcript && !ev.agent_response && !ev.meta && !ev.correction && !ev.interruption) ev.raw = JSON.stringify(d).slice(0, 400);
  if (ty !== 'vad_score') events.push(ev);
};
await opened;
ws.send(JSON.stringify({ type: 'conversation_initiation_client_data' }));

// real-time mic: 100 ms ticks of speech or silence
const silence = Buffer.alloc(CHUNK_BYTES);
let speechEndAt = 0;
const ticker = setInterval(() => {
  if (closed || ws.readyState !== 1) return;
  let chunk = silence;
  if (speechQueue.length) {
    chunk = speechQueue.shift()!;
    if (!speechQueue.length) { speechEndAt = now(); speaking = false; }
  }
  ws.send(JSON.stringify({ user_audio_chunk: chunk.toString('base64') }));
}, CHUNK_MS);

async function waitAgentDone(limitS: number): Promise<boolean> {
  const start = now();
  while (now() - start < limitS * 1000 && !closed) {
    await sleep(100);
    if (firstAudioAt !== null && now() > playEnd + 1500 && now() - lastAudioAt > 1500) return true;
  }
  return false;
}

const result: any = { label, agentId, turns: [], note: 'latency_ms = first agent audio chunk received minus end of caller speech (continuous silence streamed after)' };
try {
  // greeting
  curTurn = -1; firstAudioAt = null;
  result.greeting_first_audio_ms = null;
  const g = args.get('no-greeting') === '1' ? (await sleep(800), true) : await waitAgentDone(maxWaitS);
  result.greeting_first_audio_ms = firstAudioAt; result.greeting_done = g;
  for (let i = 0; i < turns.length && !closed; i++) {
    curTurn = i; firstAudioAt = null;
    const pcm = callerPcm[i];
    for (let o = 0; o < pcm.length; o += CHUNK_BYTES) {
      const c = Buffer.alloc(CHUNK_BYTES); pcm.copy(c, 0, o, Math.min(o + CHUNK_BYTES, pcm.length)); speechQueue.push(c);
    }
    speaking = true;
    const speechStart = now();
    while (speaking && !closed) await sleep(50);
    const done = await waitAgentDone(maxWaitS);
    const latency = firstAudioAt === null ? null : firstAudioAt - speechEndAt;
    result.turns.push({ i, text: turns[i].text, lang: turns[i].lang, note: turns[i].note, speech_ms: speechEndAt - speechStart, latency_ms: latency, done });
  }
} catch (e: any) { result.error = String(e); }
clearInterval(ticker);
if (!closed) ws.close(1000);
await sleep(500);

const byTurn = (k: number) => Buffer.concat(agentChunks.filter((c) => c.turn === k).map((c) => c.pcm));
writeFileSync(`spike/samples/${label}.agent.wav`, wav(Buffer.concat(agentChunks.map((c) => c.pcm))));
for (let k = -1; k < turns.length; k++) { const b = byTurn(k); if (b.length) writeFileSync(`spike/samples/${label}.agent.t${k + 1}.wav`, wav(b)); }
const lat = result.turns.map((t: any) => t.latency_ms).filter((x: any) => x != null).sort((a: number, b: number) => a - b);
const pct = (p: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.ceil(p * lat.length) - 1)] : null);
result.latency = { n: lat.length, p50: pct(0.5), p90: pct(0.9), min: lat[0] ?? null, max: lat[lat.length - 1] ?? null, all: result.turns.map((t: any) => t.latency_ms) };
result.conversation_id = convId; result.duration_ms_wall = now();
result.audio_formats = { in: meta.user_input_audio_format, out: meta.agent_output_audio_format };
result.events = events;
writeFileSync(`spike/${label}.log.json`, JSON.stringify(result, null, 1));
console.log(JSON.stringify({ label, conversation_id: convId, greeting_ms: result.greeting_first_audio_ms, latency: result.latency, wall_s: Math.round(result.duration_ms_wall / 1000), error: result.error, closeEvents: events.filter((e) => e.type === 'ws_close') }));
process.exit(0);
