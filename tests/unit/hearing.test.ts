import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { analyzeHearing, formatHearing, wordSimilarity, type TranscriptEntry } from "../../scripts/el/hearing";
import fixture from "../fixtures/conv_hearing.sample.json";
import { fromRoot } from "../fixtures/paths";

// Entry builders for the inline cases. The fixture below is one fictional call that exercises every counter.
const u = (t: number, message: string | null): TranscriptEntry => ({ role: "user", message, time_in_call_secs: t });
const a = (t: number, message: string | null, more: Partial<TranscriptEntry> = {}): TranscriptEntry => ({ role: "agent", message, time_in_call_secs: t, ...more });
const skip = (t: number, id = `skip_${t}`): TranscriptEntry => a(t, null, { tool_calls: [{ tool_name: "skip_turn", request_id: id }] });
const tool = (t: number, name: string): TranscriptEntry[] => [
  a(t, null, { tool_calls: [{ tool_name: name }] }),
  a(t, null, { tool_results: [{ tool_name: name }] }),
];
const GREETING_70 = "Здравствуйте. Это Анна, ИИ-ассистент. ".repeat(3).slice(0, 70); // 70 chars: ends at ~5.0 s by the 14 chars/s estimate

describe("analyzeHearing on the fictional fixture", () => {
  const h = analyzeHearing(fixture.transcript);

  it("counts caller and agent speech and the «...» silence marker apart", () => {
    expect(h.caller_turns).toBe(9);
    expect(h.agent_turns).toBe(7);
    expect(h.silence_markers).toEqual({ count: 1, times: [58] });
  });

  it("skip_turn: count and times, and which ones came right after caller speech", () => {
    expect(h.skip_turn.count).toBe(3);
    expect(h.skip_turn.times).toEqual([5, 43, 60]);
    // the hesitant first turn (5 s) and the «секундочку» turn (43 s); the one at 60 s answers a «...» silence marker
    expect(h.skip_turn.after_caller_speech_times).toEqual([5, 43]);
  });

  it("check-ins, re-asks and interrupted agent turns (the greeting included)", () => {
    expect(h.check_ins).toEqual({ count: 1, times: [12] });
    expect(h.re_asks).toEqual({ count: 1, times: [24] });
    expect(h.interrupted_agent_turns).toEqual({ count: 2, times: [0, 30] });
  });

  it("likely missed turns: the caller repeated himself with only skip_turn, a check-in or a re-ask in between", () => {
    expect(h.likely_missed_turns.map((m) => [m.at, m.repeat_at, m.between])).toEqual([
      [3, 9, ["skip_turn"]],
      [9, 15, ["check_in"]],
      [21, 27, ["re_ask"]],
    ]);
    expect(h.likely_missed_turns.map((m) => m.similarity)).toEqual([0.875, 0.667, 0.75]);
    // indexes point at the transcript entries (no text in the report)
    expect(h.likely_missed_turns.map((m) => [m.index, m.repeat_index])).toEqual([[1, 4], [4, 6], [8, 10]]);
  });

  it("unanswered caller turns: only skip_turn or nothing before the next caller turn (a check-in or re-ask is agent speech)", () => {
    expect(h.unanswered_caller_turns.map((x) => [x.at, x.next_at, x.between])).toEqual([
      [3, 9, ["skip_turn"]], // the hesitant first turn answered by skip_turn
      [32, 34, []], // nothing at all in between
      [41, 49, ["skip_turn"]],
    ]);
  });

  it("caller speech during the greeting: both the time estimate and the interrupted flag say yes (marked as an estimate)", () => {
    expect(h.greeting).toEqual({
      estimate: true, present: true, at: 0, chars: 74, est_end: 5.3, interrupted: true,
      first_caller_at: 3, by_time_estimate: true, by_interrupted_flag: true, caller_spoke_during: true, overlap_secs: 2.3,
    });
  });

  it("first reply after the greeting: a check-in, with its ttf_audio_since_silence", () => {
    expect(h.first_reply).toEqual({ index: 5, at: 12, kind: "check_in", ttf_audio_since_silence: 6.8 });
  });

  it("is pure: the input is not modified", () => {
    const copy = structuredClone(fixture.transcript);
    analyzeHearing(fixture.transcript);
    expect(fixture.transcript).toEqual(copy);
  });
});

describe("formatHearing", () => {
  const h = analyzeHearing(fixture.transcript);
  const WORDS = ["стояков", "Тестовая", "Рига", "календаре", "верно"]; // appear only in transcript messages

  it("prints no message text unless a text lookup is passed", () => {
    const out = formatHearing(h).join("\n");
    expect(out.startsWith("hearing:")).toBe(true);
    for (const w of WORDS) expect(out).not.toContain(w);
    expect(out).toContain("skip_turn calls: 3 (at 5, 43, 60 s)");
    expect(out).toContain("ESTIMATE");
    expect(out).toContain("ttf_audio_since_silence 6.80 s");
  });

  it("prints the flagged messages with --text", () => {
    const out = formatHearing(h, (i) => fixture.transcript[i]?.message ?? undefined).join("\n");
    for (const w of WORDS) expect(out).toContain(w);
  });
});

describe("analyzeHearing: edge cases", () => {
  it("test helper: the greeting stand-in is 70 chars", () => {
    expect(GREETING_70).toHaveLength(70);
    expect(GREETING_70.trim()).toHaveLength(70);
  });

  it("empty transcript", () => {
    const h = analyzeHearing([]);
    expect(h.caller_turns + h.agent_turns + h.skip_turn.count + h.check_ins.count + h.re_asks.count + h.interrupted_agent_turns.count).toBe(0);
    expect(h.likely_missed_turns).toEqual([]);
    expect(h.unanswered_caller_turns).toEqual([]);
    expect(h.greeting.present).toBe(false);
    expect(h.greeting.caller_spoke_during).toBe(false);
    expect(h.first_reply).toEqual({ index: null, at: null, kind: null, ttf_audio_since_silence: null });
  });

  it("a clean call reports nothing", () => {
    const h = analyzeHearing([
      a(0, GREETING_70), u(8, "Хочу узнать про осмотр дома"), a(10, "Хорошо. Какой адрес дома?"),
      u(14, "Тестовая улица, пять"), a(16, "Нашла: Тестовая улица, пять. Верно?"), u(19, "Да"),
    ]);
    expect(h.skip_turn.count + h.check_ins.count + h.re_asks.count + h.interrupted_agent_turns.count).toBe(0);
    expect(h.likely_missed_turns).toEqual([]);
    expect(h.unanswered_caller_turns).toEqual([]);
    expect(h.greeting.caller_spoke_during).toBe(false);
    expect(h.first_reply).toEqual({ index: 2, at: 10, kind: "speech", ttf_audio_since_silence: null });
  });

  describe("greeting overlap (estimate: greeting time + chars / 14 s, or the greeting is interrupted)", () => {
    it("70 chars end at ~5.0 s: a caller at 3 s overlaps by the time estimate alone", () => {
      const g = analyzeHearing([a(0, GREETING_70), u(3, "Здравствуйте, мне нужен осмотр")]).greeting;
      expect(g).toMatchObject({ est_end: 5, by_time_estimate: true, by_interrupted_flag: false, caller_spoke_during: true, overlap_secs: 2 });
    });
    it("an interrupted greeting counts even when the caller's time is after the estimate", () => {
      const g = analyzeHearing([a(0, GREETING_70, { interrupted: true }), u(6, "Здравствуйте, мне нужен осмотр")]).greeting;
      expect(g).toMatchObject({ by_time_estimate: false, by_interrupted_flag: true, caller_spoke_during: true, overlap_secs: -1 });
    });
    it("a caller at exactly the estimated end, or later, does not overlap", () => {
      expect(analyzeHearing([a(0, GREETING_70), u(5, "Здравствуйте")]).greeting.caller_spoke_during).toBe(false);
      expect(analyzeHearing([a(0, GREETING_70), u(9, "Здравствуйте")]).greeting.caller_spoke_during).toBe(false);
    });
    it("charsPerSec moves the estimate", () => {
      const tr = [a(0, GREETING_70), u(6, "Здравствуйте")];
      expect(analyzeHearing(tr).greeting.caller_spoke_during).toBe(false);
      expect(analyzeHearing(tr, { charsPerSec: 7 }).greeting).toMatchObject({ est_end: 10, caller_spoke_during: true });
    });
    it("an interrupted greeting with no transcribed caller speech still counts", () => {
      expect(analyzeHearing([a(0, GREETING_70, { interrupted: true })]).greeting).toMatchObject({ present: true, first_caller_at: null, by_interrupted_flag: true, caller_spoke_during: true });
    });
    it("a transcript that starts with the caller has no greeting entry", () => {
      const g = analyzeHearing([u(1, "Алло, здравствуйте"), a(3, GREETING_70)]).greeting;
      expect(g).toMatchObject({ present: false, at: null, est_end: null, caller_spoke_during: false });
    });
  });

  describe("silence markers", () => {
    const tr = [
      a(0, GREETING_70), u(6, "..."), a(9, "Алло, вы меня слышите?", { conversation_turn_metrics: { metrics: { ttf_audio_since_silence: 7.5 } } }),
      u(15, "..."), skip(17), u(22, "Да, слышу"),
    ];
    it("«...» is not a caller turn: no unanswered turn, no missed turn, skip_turn after it is not «after caller speech»", () => {
      const h = analyzeHearing(tr);
      expect(h.caller_turns).toBe(1);
      expect(h.silence_markers.times).toEqual([6, 15]);
      expect(h.skip_turn).toEqual({ count: 1, times: [17], after_caller_speech_times: [] });
      expect(h.likely_missed_turns).toEqual([]);
      expect(h.unanswered_caller_turns).toEqual([]);
    });
    it("the first reply after a silent first turn is the check-in; a plain-number metric without the convai_ prefix is read too", () => {
      expect(analyzeHearing(tr).first_reply).toEqual({ index: 2, at: 9, kind: "check_in", ttf_audio_since_silence: 7.5 });
    });
  });

  describe("what sits between two caller turns", () => {
    it("real tool work (any tool but skip_turn) means the agent heard: neither unanswered nor missed", () => {
      const h = analyzeHearing([u(4, "Тестовая улица пять"), ...tool(6, "lookup_building"), u(8, "Тестовая улица пять"), a(10, "Нашла.")]);
      expect(h.unanswered_caller_turns).toEqual([]);
      expect(h.likely_missed_turns).toEqual([]);
    });
    it("an answer in between means no repeat was needed, even for identical words", () => {
      const h = analyzeHearing([u(3, "Да"), a(4, "Хорошо, какой адрес?"), u(7, "Да")]);
      expect(h.likely_missed_turns).toEqual([]);
      expect(h.unanswered_caller_turns).toEqual([]);
    });
    it("a check-in between two different messages is neither missed nor unanswered", () => {
      const h = analyzeHearing([u(3, "Мне нужен осмотр дома"), a(5, "Алло, вы меня слышите?"), u(8, "Да, слышу, говорите")]);
      expect(h.likely_missed_turns).toEqual([]);
      expect(h.unanswered_caller_turns).toEqual([]);
      expect(h.check_ins.count).toBe(1);
    });
    it("two different messages with nothing between are unanswered but not a repeat", () => {
      const h = analyzeHearing([u(3, "Мне нужен осмотр дома"), u(6, "Подскажите, сколько это стоит")]);
      expect(h.likely_missed_turns).toEqual([]);
      expect(h.unanswered_caller_turns).toEqual([{ index: 0, at: 3, next_index: 1, next_at: 6, between: [] }]);
    });
    it("the Latvian and English check-in and re-ask phrases are recognised", () => {
      const h = analyzeHearing([a(1, "Hallo, vai jūs mani dzirdat?"), a(2, "Can you hear me?"), a(3, "Šķiet, nesadzirdēju vienu ciparu"), a(4, "Sorry, I didn’t catch that")]);
      expect(h.check_ins.times).toEqual([1, 2]);
      expect(h.re_asks.times).toEqual([3, 4]);
    });
  });

  describe("similarity threshold (default 0.6, word-set Jaccard)", () => {
    const pair = [u(3, "Тестовая улица, пять"), u(6, "Тестовая улица, дом пять, Рига")]; // 3 shared of 5 words = 0.6
    it("is inclusive at the threshold and configurable", () => {
      expect(analyzeHearing(pair).likely_missed_turns).toHaveLength(1);
      expect(analyzeHearing(pair, { similarity: 0.7 }).likely_missed_turns).toEqual([]);
    });
  });

  describe("robustness", () => {
    it("tolerates nulls, a name instead of tool_name, missing times, unknown roles and a repeated call id", () => {
      const odd: TranscriptEntry[] = [
        { role: "agent", message: null, tool_calls: null, tool_results: null, conversation_turn_metrics: null },
        a(0, "Здравствуйте"),
        u(2, null),
        u(4, "Алло"),
        a(5, null, { tool_calls: [{ name: "skip_turn" }] }),
        { role: "agent", message: null, tool_calls: [{ tool_name: "skip_turn", request_id: "dup" }, { tool_name: "skip_turn", request_id: "dup" }] },
        { role: "system", message: "ignored" },
      ];
      const h = analyzeHearing(odd);
      expect(h.caller_turns).toBe(1);
      expect(h.agent_turns).toBe(1);
      expect(h.skip_turn).toEqual({ count: 2, times: [5, 5], after_caller_speech_times: [5, 5] }); // the entry without a time takes the previous time
    });
  });
});

describe("wordSimilarity", () => {
  it("ignores case, punctuation and ё/е", () => {
    expect(wordSimilarity("Здравствуйте, я хочу осмотр!", "здравствуйте я хочу осмотр")).toBe(1);
    expect(wordSimilarity("Всё верно", "все верно")).toBe(1);
  });
  it("drops hesitation sounds and stammer fragments", () => {
    expect(wordSimilarity("Э-э, ну, да", "Да")).toBe(1);
    expect(wordSimilarity("А-а-м, п-по поводу", "по поводу")).toBe(1);
    expect(wordSimilarity("мама", "мама")).toBe(1); // a real word that looks like a filler stays
  });
  it("keeps digits and counts the Jaccard overlap", () => {
    expect(wordSimilarity("дом 9", "дом 5")).toBeCloseTo(1 / 3, 10);
    expect(wordSimilarity("осмотр дома", "осмотр крыши")).toBeCloseTo(1 / 3, 10);
  });
  it("is 0 when either side has no word left", () => {
    expect(wordSimilarity("...", "да")).toBe(0);
    expect(wordSimilarity("Э-э...", "м-м")).toBe(0);
    expect(wordSimilarity("", "")).toBe(0);
  });
});

// The audition script is a CLI (top-level await, no exports): smoke-test it as a child process with fetch poisoned, so a call to the
// network would fail the run. The dry run must need no key and make zero API calls; --run must refuse an over-budget matrix first.
describe("voice-audition (offline smoke test)", () => {
  const script = fromRoot("scripts/el/voice-audition.ts");
  const poison = `data:text/javascript,${encodeURIComponent("globalThis.fetch = () => { throw new Error('the audition must not reach the network here'); };")}`;
  const run = (args: string[], key?: string) => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.ELEVENLABS_API_KEY;
    if (key) env.ELEVENLABS_API_KEY = key;
    return spawnSync(process.execPath, ["--import", poison, script, ...args], { env, encoding: "utf8" });
  };

  it("--dry (the default) prints the matrix and a labelled credit estimate, with no key and no API call", () => {
    const r = run([]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("DRY RUN");
    expect(r.stdout).toContain("matrix: 3 voices x 2 models x 2 stabilities x 3 lines = 36 renders");
    expect(r.stdout).toContain("total: 2,268 characters in 36 renders");
    expect(r.stdout).toContain("credit estimate: ~1,134 credits (estimate; check el:credits before/after)");
    expect(r.stdout).toContain("--max-chars 3,000: OK");
    expect(r.stdout).toContain("Anna ET");
  });

  it("the credit estimate is x0.5 for eleven_v4_turbo and eleven_flash_v2_5, x1.0 for other models", () => {
    const half = run(["--dry", "--voices", "2wP8BdKwYp0tZqqoNvMa", "--models", "eleven_v4_turbo,eleven_flash_v2_5", "--stability", "0.5", "--lines", "ack"]);
    expect(half.stdout).toContain("total: 50 characters in 2 renders");
    expect(half.stdout).toContain("~25 credits");
    const full = run(["--dry", "--voices", "2wP8BdKwYp0tZqqoNvMa", "--models", "eleven_multilingual_v2", "--stability", "0.5", "--lines", "ack"]);
    expect(full.stdout).toContain("~25 credits"); // 25 characters, one render, x1.0
    expect(full.stdout).toContain("total: 25 characters in 1 render\n");
  });

  it("--run refuses a matrix above --max-chars before any API call", () => {
    const r = run(["--run", "--lines", "all"], "dummy-not-a-secret"); // fetch is poisoned: an API call would have thrown, not printed this
    expect(r.status, r.stderr).toBe(2);
    expect(r.stderr).toContain("refusing to run");
    expect(r.stderr).toContain("No API call was made");
  });

  it("--run needs ELEVENLABS_API_KEY", () => {
    const r = run(["--run"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("ELEVENLABS_API_KEY missing");
  });
});
