// Hearing diagnosis for ONE ElevenLabs conversation transcript: did Anna hear the caller? Pure functions, no I/O, no imports
// (tsc type-checks this file through tests/unit/hearing.test.ts; scripts/el/call-metrics.ts prints the «hearing:» block).
//
// Input: GET /v1/convai/conversations/{id} -> .transcript[]: role user|agent, message (string|null), time_in_call_secs,
//   interrupted, tool_calls[{tool_name|name, params_as_json}], tool_results[{tool_name}], conversation_turn_metrics.metrics.
// The report holds numbers, times and transcript INDEXES only, never message text (names and phones may be in a transcript).
//
// Definitions
//  - caller speech: a user message with at least one letter or digit. A user message of only dots («...», the platform's mark for
//    a silent turn) is a silence marker: counted apart, never a caller turn.
//  - skip_turn: a tool call named skip_turn on any entry (a call id seen twice counts once).
//  - check-in: agent message matching CHECK_IN_RE; re-ask: matching RE_ASK_RE; interrupted agent turn: an agent message
//    with interrupted = true (the greeting included).
//  - Between two consecutive caller-speech entries the agent either spoke an answer, did real tool work (any tool but skip_turn),
//    said only a check-in / re-ask, did only skip_turn, or did nothing.
//  - likely missed turn: the second of the two near-duplicates (word-set similarity >= 0.6, see wordSimilarity) when between them
//    there is only a check-in, a re-ask, skip_turn or nothing: the caller had to repeat himself.
//  - unanswered caller turn: a caller-speech entry followed by another with nothing between but skip_turn or nothing (no agent speech,
//    no real tool work). A check-in or re-ask is agent speech, so it is reported under check-ins / re-asks / likely missed only.
//  - greeting overlap, ESTIMATE only: the first caller speech starts before the greeting is estimated to end
//    (greeting time + chars / charsPerSec), or the greeting entry is interrupted. time_in_call_secs has 1 s resolution.
//  - first reply: the first agent message after the first user entry; its ttf_audio_since_silence (s) when the metric is there.

export interface ToolCallLike {
  tool_name?: string | null;
  name?: string | null;
  request_id?: string | null;
  tool_call_id?: string | null;
  params_as_json?: string | null;
}
export interface ToolResultLike { tool_name?: string | null; name?: string | null }
export type MetricValue = number | { elapsed_time?: number | null } | null | undefined;
export interface TranscriptEntry {
  role?: string | null;
  message?: string | null;
  time_in_call_secs?: number | null;
  interrupted?: boolean | null;
  tool_calls?: readonly ToolCallLike[] | null;
  tool_results?: readonly ToolResultLike[] | null;
  conversation_turn_metrics?: { metrics?: Readonly<Record<string, MetricValue>> | null } | null;
}

export interface HearingOptions {
  /** Speech rate for the greeting-end estimate (default 14 chars/s, the same constant call-metrics uses). */
  charsPerSec?: number;
  /** Word-set similarity at or above which two caller messages are near-duplicates (default 0.6). */
  similarity?: number;
}

export interface TimedCount { count: number; times: number[] }
export interface SkipTurnInfo extends TimedCount {
  /** Times of the skip_turn calls whose latest user entry was caller speech (not a «...» silence marker). */
  after_caller_speech_times: number[];
}
export interface MissedTurn {
  /** Transcript indexes of the first (unheard) and the repeated caller message. */
  index: number;
  repeat_index: number;
  at: number;
  repeat_at: number;
  similarity: number;
  /** Tags of what happened in between: check_in, re_ask, skip_turn, silence (a «...» user entry). */
  between: string[];
}
export interface UnansweredTurn {
  index: number;
  at: number;
  next_index: number;
  next_at: number;
  /** skip_turn and/or silence; empty when nothing happened between the two caller turns. */
  between: string[];
}
export interface GreetingReport {
  /** Always true: everything here except `interrupted` is an estimate (see the header). */
  estimate: true;
  /** The first message of the transcript is the agent's. */
  present: boolean;
  at: number | null;
  chars: number;
  est_end: number | null;
  interrupted: boolean;
  first_caller_at: number | null;
  by_time_estimate: boolean;
  by_interrupted_flag: boolean;
  caller_spoke_during: boolean;
  /** est_end - first_caller_at, 1 decimal; positive = the caller began that many seconds before the estimated end. */
  overlap_secs: number | null;
}
export interface FirstReply {
  index: number | null;
  at: number | null;
  kind: 'check_in' | 're_ask' | 'speech' | null;
  ttf_audio_since_silence: number | null;
}
export interface HearingReport {
  caller_turns: number;
  agent_turns: number;
  silence_markers: TimedCount;
  skip_turn: SkipTurnInfo;
  check_ins: TimedCount;
  re_asks: TimedCount;
  interrupted_agent_turns: TimedCount;
  likely_missed_turns: MissedTurn[];
  unanswered_caller_turns: UnansweredTurn[];
  greeting: GreetingReport;
  first_reply: FirstReply;
}

export const CHECK_IN_RE = /Алло, вы меня слышите|vai jūs mani dzirdat|can you hear me/i;
export const RE_ASK_RE = /не расслышал|nesadzirdēj|didn['’]?t catch/i;
export const SKIP_TURN = 'skip_turn';
export const DEFAULT_CHARS_PER_SEC = 14;
export const DEFAULT_SIMILARITY = 0.6;

// ---------------------------------------------------------------------------------------------------------------------------
// word-set similarity

// hesitation sounds: doubled letters (ээ, мм, аа), эм/ам/хм/гм, ну. Single letters are dropped separately (stammer: «п-по»).
const FILLER = /^(?:(\p{L})\1+|[эа]м+|хм+|гм+|ну+)$/u;

function wordSet(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s.normalize('NFC').toLowerCase().replaceAll('ё', 'е').split(/[^\p{L}\p{N}]+/u)) {
    if (!w || /^\p{L}$/u.test(w) || FILLER.test(w)) continue;
    out.add(w);
  }
  return out;
}

/** Jaccard similarity (0..1) of the normalised word sets: lower case, ё = е, punctuation and single letters dropped, hesitation
 *  sounds («э-э», «м-м», «а-а-м», «ну») dropped. 0 when either side has no word left. */
export function wordSimilarity(a: string, b: string): number {
  const A = wordSet(a), B = wordSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

// ---------------------------------------------------------------------------------------------------------------------------
// transcript -> flat events

interface Call { name: string; id: string | null }
interface Ev { index: number; role: 'user' | 'agent'; t: number; msg: string; interrupted: boolean; calls: Call[]; results: string[] }

const hasWords = (s: string): boolean => /[\p{L}\p{N}]/u.test(s);
const r1 = (x: number): number => Math.round(x * 10) / 10;
const r3 = (x: number): number => Math.round(x * 1000) / 1000;

function toEvents(transcript: readonly TranscriptEntry[]): Ev[] {
  const out: Ev[] = [];
  let lastT = 0;
  transcript.forEach((e, index) => {
    const role = e.role === 'user' ? 'user' : e.role === 'agent' ? 'agent' : null;
    if (!role) return;
    const t = typeof e.time_in_call_secs === 'number' && Number.isFinite(e.time_in_call_secs) ? e.time_in_call_secs : lastT;
    lastT = t;
    out.push({
      index, role, t,
      msg: typeof e.message === 'string' ? e.message.normalize('NFC').trim() : '',
      interrupted: e.interrupted === true,
      calls: (e.tool_calls ?? []).map((c) => ({ name: (c.tool_name ?? c.name ?? '').trim(), id: c.tool_call_id ?? c.request_id ?? null })),
      results: (e.tool_results ?? []).map((r) => (r.tool_name ?? r.name ?? '').trim()),
    });
  });
  return out;
}

function metric(e: TranscriptEntry | undefined, name: string): number | null {
  const m = e?.conversation_turn_metrics?.metrics;
  if (!m) return null;
  const v = m[`convai_${name}`] ?? m[name];
  const n = typeof v === 'number' ? v : v?.elapsed_time;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** What happened strictly between two entries (exclusive indexes into `evs`), as unique tags in order of appearance. */
function tagsBetween(evs: readonly Ev[], from: number, to: number): string[] {
  const tags: string[] = [];
  const add = (t: string): void => { if (!tags.includes(t)) tags.push(t); };
  for (let k = from + 1; k < to; k++) {
    const e = evs[k];
    if (!e) continue;
    if (e.role === 'user') { if (e.msg) add('silence'); continue; } // caller speech cannot sit between consecutive caller-speech entries
    if (e.msg) {
      const ci = CHECK_IN_RE.test(e.msg), ra = RE_ASK_RE.test(e.msg);
      if (ci) add('check_in');
      if (ra) add('re_ask');
      if (!ci && !ra) add('agent_speech');
    }
    for (const c of e.calls) add(c.name === SKIP_TURN ? 'skip_turn' : `tool:${c.name || '?'}`);
    for (const r of e.results) add(r === SKIP_TURN ? 'skip_turn' : `tool:${r || '?'}`);
  }
  return tags;
}

// ---------------------------------------------------------------------------------------------------------------------------

export function analyzeHearing(transcript: readonly TranscriptEntry[], opts: HearingOptions = {}): HearingReport {
  const charsPerSec = opts.charsPerSec && opts.charsPerSec > 0 ? opts.charsPerSec : DEFAULT_CHARS_PER_SEC;
  const threshold = opts.similarity ?? DEFAULT_SIMILARITY;
  const evs = toEvents(transcript);

  const silence: TimedCount = { count: 0, times: [] };
  const skip: SkipTurnInfo = { count: 0, times: [], after_caller_speech_times: [] };
  const checkIns: TimedCount = { count: 0, times: [] };
  const reAsks: TimedCount = { count: 0, times: [] };
  const interrupted: TimedCount = { count: 0, times: [] };
  const push = (c: TimedCount, t: number): void => { c.count++; c.times.push(t); };

  let lastUser: 'speech' | 'silence' | null = null;
  let callerTurns = 0, agentTurns = 0;
  const seenCallIds = new Set<string>();
  const speechAt: number[] = []; // indexes into evs of the caller-speech entries
  evs.forEach((e, k) => {
    if (e.role === 'user') {
      if (hasWords(e.msg)) { lastUser = 'speech'; callerTurns++; speechAt.push(k); }
      else if (e.msg) { lastUser = 'silence'; push(silence, e.t); }
      return;
    }
    for (const c of e.calls) {
      if (c.name !== SKIP_TURN) continue;
      if (c.id) { if (seenCallIds.has(c.id)) continue; seenCallIds.add(c.id); }
      push(skip, e.t);
      if (lastUser === 'speech') skip.after_caller_speech_times.push(e.t);
    }
    if (!e.msg) return;
    agentTurns++;
    if (CHECK_IN_RE.test(e.msg)) push(checkIns, e.t);
    if (RE_ASK_RE.test(e.msg)) push(reAsks, e.t);
    if (e.interrupted) push(interrupted, e.t);
  });

  // consecutive caller-speech pairs
  const missed: MissedTurn[] = [];
  const unanswered: UnansweredTurn[] = [];
  for (let n = 0; n + 1 < speechAt.length; n++) {
    const a = evs[speechAt[n] ?? -1], b = evs[speechAt[n + 1] ?? -1];
    if (!a || !b) continue;
    const between = tagsBetween(evs, speechAt[n]!, speechAt[n + 1]!);
    const reacted = between.some((t) => t === 'agent_speech' || t.startsWith('tool:')); // an answer or real tool work
    const spoke = reacted || between.includes('check_in') || between.includes('re_ask');
    if (!spoke) unanswered.push({ index: a.index, at: a.t, next_index: b.index, next_at: b.t, between });
    if (!reacted) {
      const similarity = wordSimilarity(a.msg, b.msg);
      if (similarity >= threshold) missed.push({ index: a.index, repeat_index: b.index, at: a.t, repeat_at: b.t, similarity: r3(similarity), between });
    }
  }

  // greeting overlap (estimate)
  const firstText = evs.find((e) => e.msg !== '');
  const greetingEv = firstText && firstText.role === 'agent' ? firstText : undefined;
  const firstSpeech = speechAt.length ? evs[speechAt[0] ?? -1] : undefined;
  const greeting: GreetingReport = {
    estimate: true, present: !!greetingEv, at: greetingEv?.t ?? null, chars: 0, est_end: null, interrupted: false,
    first_caller_at: null, by_time_estimate: false, by_interrupted_flag: false, caller_spoke_during: false, overlap_secs: null,
  };
  if (greetingEv) {
    greeting.chars = [...greetingEv.msg].length;
    greeting.est_end = r1(greetingEv.t + greeting.chars / charsPerSec);
    greeting.interrupted = greetingEv.interrupted;
    greeting.by_interrupted_flag = greetingEv.interrupted;
    if (firstSpeech) {
      greeting.first_caller_at = firstSpeech.t;
      greeting.by_time_estimate = firstSpeech.t < greetingEv.t + greeting.chars / charsPerSec;
      greeting.overlap_secs = r1(greetingEv.t + greeting.chars / charsPerSec - firstSpeech.t);
    }
    greeting.caller_spoke_during = greeting.by_time_estimate || greeting.by_interrupted_flag;
  }

  // first agent message after the first user entry, and its time to first audio since the caller's silence
  const firstUser = evs.findIndex((e) => e.role === 'user' && e.msg !== '');
  const reply = firstUser < 0 ? undefined : evs.slice(firstUser + 1).find((e) => e.role === 'agent' && e.msg !== '');
  const firstReply: FirstReply = { index: null, at: null, kind: null, ttf_audio_since_silence: null };
  if (reply) {
    firstReply.index = reply.index;
    firstReply.at = reply.t;
    firstReply.kind = CHECK_IN_RE.test(reply.msg) ? 'check_in' : RE_ASK_RE.test(reply.msg) ? 're_ask' : 'speech';
    firstReply.ttf_audio_since_silence = metric(transcript[reply.index], 'ttf_audio_since_silence');
  }

  return {
    caller_turns: callerTurns, agent_turns: agentTurns, silence_markers: silence, skip_turn: skip, check_ins: checkIns,
    re_asks: reAsks, interrupted_agent_turns: interrupted, likely_missed_turns: missed, unanswered_caller_turns: unanswered,
    greeting, first_reply: firstReply,
  };
}

/** Lines for the «hearing:» block. Message text appears only when `text` is given (it maps a transcript index to its message). */
export function formatHearing(h: HearingReport, text?: (index: number) => string | undefined): string[] {
  const at = (ts: readonly number[]): string => (ts.length ? ` (at ${ts.join(', ')} s)` : '');
  const q = (i: number): string => `«${(text?.(i) ?? '').trim()}»`;
  const tags = (b: readonly string[]): string => (b.length ? b.join(', ') : 'nothing');
  const g = h.greeting, fr = h.first_reply;
  const L: string[] = ['hearing:'];
  L.push(`  turns: ${h.caller_turns} caller speech, ${h.agent_turns} agent speech, ${h.silence_markers.count} silent «...»${at(h.silence_markers.times)}`);
  L.push(`  skip_turn calls: ${h.skip_turn.count}${at(h.skip_turn.times)}`
    + (h.skip_turn.count ? `; right after caller speech: ${h.skip_turn.after_caller_speech_times.length}${at(h.skip_turn.after_caller_speech_times)}` : ''));
  L.push(`  check-ins «Алло, вы меня слышите?»: ${h.check_ins.count}${at(h.check_ins.times)}`);
  L.push(`  re-asks «не расслышал…»: ${h.re_asks.count}${at(h.re_asks.times)}`);
  L.push(`  interrupted agent turns: ${h.interrupted_agent_turns.count}${at(h.interrupted_agent_turns.times)}`);
  L.push(`  likely missed turns (caller repeated himself; only check-in, re-ask, skip_turn or nothing in between): ${h.likely_missed_turns.length}`);
  for (const m of h.likely_missed_turns) {
    L.push(`    ${m.at} s -> ${m.repeat_at} s | similarity ${m.similarity.toFixed(2)} | between: ${tags(m.between)}`);
    if (text) L.push(`      ${q(m.index)}`, `      ${q(m.repeat_index)}`);
  }
  L.push(`  unanswered caller turns (next caller turn came with no agent speech, or only skip_turn, in between): ${h.unanswered_caller_turns.length}`);
  for (const u of h.unanswered_caller_turns) {
    L.push(`    ${u.at} s (next caller turn at ${u.next_at} s) | between: ${tags(u.between)}`);
    if (text) L.push(`      ${q(u.index)}`);
  }
  if (!g.present) L.push('  caller speech during the greeting: n/a (the transcript does not start with an agent message)');
  else {
    const gap = g.overlap_secs === null ? '' : g.overlap_secs > 0 ? `, ${g.overlap_secs} s before the estimated end` : `, ${r1(-g.overlap_secs)} s after the estimated end`;
    const parts = [
      `greeting at ${g.at} s, ${g.chars} chars, ends ~${g.est_end} s`,
      g.first_caller_at === null ? 'no caller message' : `first caller message at ${g.first_caller_at} s${gap}`,
    ];
    if (g.by_interrupted_flag) parts.push('greeting entry is marked interrupted');
    L.push(`  caller speech during the greeting: ${g.caller_spoke_during ? 'YES' : 'no'} (ESTIMATE: ${parts.join('; ')})`);
  }
  L.push(fr.at === null
    ? '  first reply after the greeting: none'
    : `  first reply after the greeting: at ${fr.at} s [${fr.kind === 'check_in' ? 'check-in' : fr.kind === 're_ask' ? 're-ask' : 'speech'}], ttf_audio_since_silence `
      + `${fr.ttf_audio_since_silence === null ? 'n/a' : `${fr.ttf_audio_since_silence.toFixed(2)} s`}${text && fr.index !== null ? ` ${q(fr.index)}` : ''}`);
  return L;
}
