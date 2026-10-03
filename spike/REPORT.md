# WP4 spike report: ElevenLabs Agents for Anna (LV/RU)

Date 2026-10-03. Paths are relative to `Dima voice/`. Raw evidence is in `spike/` (redacted JSON; audio in the git-ignored `spike/samples/`).
Usage: **10.88 voice min** (limit 15, stop 12), **$0.293 LLM** (limit $0.5), plus unmetered TTS/STT test credits. No Pay As You Go. All five `scg-spike-*` agents deleted (`spike/cleanup_proof.json`); the pre-existing agents were not touched. About 3 of the minutes are a duplicate RU batch launched by mistake (its server-side metrics are still in `q5_server_metrics.json`).

## Verdicts
| # | Question | Verdict |
|---|---|---|
| 1 | `language: lv` accepted, TTS model kept? | Yes for `eleven_v3_conversational` and `eleven_v4_turbo`; kept after create and PATCH. No silent fallback: `lv` with `eleven_flash_v2_5` / `eleven_multilingual_v2` is rejected with 422. |
| 2 | Mid-call LV->RU switching | Works (3 runs). A RU sentence with "Ilūkstes iela" caused no further switch (runs B and v4). **RU->LV switching is unproven** (never tested). Caveats below. |
| 3 | LV numbers and dates | `eleven_v4_turbo` correct 9/9; `eleven_v3` wrong in 4/9 for "90 320". Dates and "9 stavi" fine on both. |
| 4 | Versioning/publishing | No publish step: a PATCH makes a new Main version that the next call runs. |
| 5 | Latency and cost | See table. Rule outcome: Haiku 4.5; Sonnet borderline; Opus fails. |
| 6 | `system__timezone` | Null on raw websocket; populated on the real talk-to link (browser zone). |

## 1. Language and TTS model
- Evidence: `spike/q1_lang_tts.json` (create + read-back: `language: lv`, `tts.model_id` as sent, `language_presets.ru.overrides.agent.{first_message,language}`); `spike/q1b_tts_fallback.json` (422 "Language lv is not supported for model ..." for non-LV models; PATCH v3->v4->v3 each kept; bogus language -> 400 with the valid list).
- Read-back defaults (saved in `spike/q1_lang_tts.json`): `tts.expressive_mode:true`, `text_normalisation_type:"system_prompt"`, `agent_output_audio_format:"pcm_16000"`. ASR provider `scribe_realtime` is in `metadata.charging.asr_usage` of `spike/conv_*.json`. (Turn-taking defaults such as `turn_timeout`/`turn_eagerness` were seen in a read-back that was not saved; they are not claimed here.)
- Model actually used per call: `metadata.charging.tts_usage.primary_tts_model` in `spike/conv_*.json`.

## 2. Mid-call switching
- Evidence: `spike/langswitch_v3_A.log.json`, `langswitch_v3_B.log.json`, `langswitch_v4.log.json` (events, transcripts, `agent_tool_response` for `language_detection`); `spike/conv_langswitch_*.json`; audio `spike/samples/langswitch_*`.
- Run A had only **2 caller turns** (it hit the 60 s cap before turn 3; the greeting plus long sentences ate the time), so the street-name no-switch evidence comes from run B (v3) and the v4 run only. Caller started LV, then said "Давайте лучше по-русски. Как проходит осмотр?", then "Мой дом на Ilūkstes iela, девять этажей." Result: language_detection(ru) on turn 2 in all 3 runs, no tool call on turn 3 (B, v4), Anna stayed Russian.
- Caveat A: ASR is language-fixed until the switch. The first RU sentence was transcribed in Latvian letters ("Izvinīti, davajti luši paruski", run A); the LLM understood and switched anyway. Do not branch on that transcript text.
- Caveat B: in RU mode ASR writes Latvian street names in Cyrillic ("Иллюкса съела", "Елукстес Йела"); v4 repeated "Илукстес иела", v3 said it with a Russian accent. Needs a prompt rule (write Latvian names in Latin script) and maybe `asr.keywords` (untested).
- **Not tested: RU->LV switching (unproven)** and the false-switch rate over many samples (two samples). WP8 EL Tests must cover both.
- Latency of the first turn after the greeting: `turn_silence_before_initiation` was 2.08, 1.76 and 1.82 s in the three runs (`spike/conv_langswitch_v3_A.json:515`, `conv_langswitch_v3_B.json`, `conv_langswitch_v4.json`) vs 0.19-0.22 s on the first turn without a greeting (`conv_lat_lv_*.json`). With the greeting, Sonnet's end-to-end time to first audio was 2.4-3.8 s (server `ttf_audio_since_silence` 2.36-3.84 s, client 2.6-4.0 s) vs about 1.5 s without it. The meeting flow starts with the greeting, so budget for a slow first reply.
- Claude emits `[happy]`/`[friendly]` audio tags in `agent_response`. Not spoken (`spike/q_agent_audio_stt.json`) but present in transcripts; lint must strip them or set `expressive_mode:false`.

## 3. LV numbers and dates (TTS -> scribe_v1 back)
- Evidence: `spike/q3_numbers_dates.json` (22 samples), `q3b_word_timing.json`, `q3c_number_repeats.json` (3 repeats x 3 phrases x 2 models), audio `spike/samples/q3/*.mp3` (voice Ilze).
- v4_turbo: 90 320 / 109 287 eiro, 5742 / 6542 eiro (once spelled out in words, correct), "2026. gada 14. oktobrī pulksten 10.30", "deviņi stāvi un četras kāpņu telpas", "trīsdesmit septiņi", phone digits; RU "90 320 евро", "14 октября 2026 года": all correct.
- v3: price misread in 4/9 repeats (9320; 90 000 līdz 320 000; 93 320; 93 220; RU 900 320 once); grammar slips ("četri skāpņa telpas", "trīsdesmit septiņas").
- **Proven via the TTS API only, not inside the agent.** The agent runs with `text_normalisation_type: system_prompt` and its own LLM text path; no agent call in this spike spoke a price or date, so numbers inside Anna are unproven (WP8/V1 must check with a synthetic call). Caveats: TTS API ids `eleven_v3`/`eleven_v4_turbo` were tested; the agent uses `eleven_v3_conversational` (not callable on the TTS API). Scribe normalises spoken numbers to digits, so correctness rests on the digits plus word timings. Keep the plan fallback (prices spelled as words in `say_lv`) as a cheap safety net.

## 4. Versioning and publishing
- Evidence: `spike/q4a_versioning.json`, `q4b_versions_live.json` (branch, version chain, version of each conversation), `q4c_auth_lock.json`.
- One Main branch, `current_live_percentage:100`, `draft_exists:false`, `protection_status:writer_perms_required`. Each PATCH adds a version (seq 1->4) whose id matches the PATCH response, the GET and the next conversation. Call A (before PATCH) ran `agtvrsn_7101...`, call B (right after, no publish) ran `agtvrsn_0501...`. Same for the language/prompt PATCHes on the latency agents.
- Public websocket by agent_id works with `enable_auth:false`; with `true` it closes at once with code 3000 "requires conversations to be authorized" (lock/unlock = one PATCH, a new version each).
- Meter gotcha: deleting an agent removes its conversations from the API. Log usage before deleting; `usage.ts --log` stores the API total in the row (`api=min:X,usd:Y`) so later deltas stay correct.

## 5. Latency and cost per minute (v4_turbo, voice Ilze, one-short-sentence replies, max 60 s)
| LLM | client p50 / p90 (8 turns) | server p50 / p90 (12 turns) | LLM TTFB p50 | LLM $/min | voice $/min | total $/min |
|---|---|---|---|---|---|---|
| claude-opus-5-5 | 1.87 / 3.29 s | 1.725 / 2.43 s | 0.8-0.95 s | 0.032-0.044 | 0.033 | 0.064-0.077 |
| claude-sonnet-5-5 | 1.69 / 3.19 s | 1.515 / 2.74 s | 0.5-0.6 s | 0.024-0.032 | 0.033 | 0.057-0.065 |
| claude-haiku-4-5 | 1.37 / 2.25 s | 1.22 / 1.49 s | 0.33-0.37 s | 0.013-0.015 | 0.033 | 0.046-0.048 |

- Medians are true medians (mean of the middle two for even n), re-derived. Per language (client LV / RU, 4 turns each; server LV 4 turns / RU 8 turns): Opus client 2.03 / 1.87 s, server 1.89 / 1.70 s; Sonnet client 1.59 / 2.04 s, server 1.50 / 1.56 s; Haiku client 1.55 / 1.13 s, server 1.48 / 1.11 s. Haiku on LV turns is therefore 1.5 s, not 1.2-1.3 s: the headline median is helped by the faster RU turns.
- Evidence: `spike/lat_lv_*.log.json`, `lat_ru_*.log.json` (client), `spike/q5_server_metrics.json` (server), `spike/conv_lat_lv_*.json` (cost, per-turn metrics).
- Other components: TTS TTFB 0.08-0.09 s (v4t) vs 0.16-0.24 s (v3c); turn-end wait about 0.2-0.3 s typically (1.1-1.8 s occasionally). First greeting audio about 0.6 s after connect; the bilingual greeting takes 9.4-10.8 s to speak. A language-switch turn adds about 1 s (tool round trip).
- Voice cost: `eleven_v3_conversational` $0.080/min (628 credits per 60 s with Sonnet, `spike/conv_langswitch_v3_B.json`) vs `eleven_v4_turbo` $0.033/min (about 350 credits per 60 s, `spike/conv_langswitch_v4.json`).
- Haiku quality warning (judge finding, `spike/lat_lv_haiku.log.json:82-118`): in 4 LV turns Haiku made **2 unsupported claims** ("Apskate ... ātri notiek"; "Varat zvanīt mums vai aizpildīt pieprasījumu mūsu vietnē") and **3 case/gender errors** ("jūsu adreses" for "adrese", three times). Sonnet in the same turns said it had no details. Latency alone must not decide.
- Unknown: how minutes are drawn from the Creator allowance (`free_minutes_consumed:0`; the key lacks `user_read`).

## 6. `system__timezone`
- Raw websocket: `system__timezone:null`, `metadata.timezone:null`; `system__time_utc`/`system__time` present (`spike/conv_langswitch_v3_B.json`, `conversation_initiation_client_data.dynamic_variables`).
- Browser path: a pre-existing conversation with source `react_sdk` on another agent (only the timezone fields were saved, `spike/q6_timezone_evidence.json`) shows `system__timezone` = `metadata.timezone` = `Europe/Tallinn`, i.e. the visitor's browser zone. It is not confirmed that this conversation came through the talk-to link itself (the source label is `react_sdk`), so re-check on the real link at H3. Use Riga time from the Worker.

## Recommendation
- TTS: `eleven_v4_turbo` (correct LV numbers and grammar, about half the TTFB, 59% cheaper per voice minute, handles RU and the bilingual greeting). `eleven_v3_conversational` not recommended for prices.
- LLM: by the fixed rule (start Opus; p50 > 1.5 s -> Sonnet, then Haiku) the outcome is Haiku 4.5 (client median 1.37 s overall, but 1.55 s on LV turns, and the quality warning above). Sonnet is borderline (1.515 s server / 1.69 s client); Opus fails (median 1.7-1.9 s, p90 up to 3.3 s). Sonnet vs Haiku is a Gate S judgement with WP8 test results; turn-taking tuning (eagerness) is untested.
- Keep `language: lv` + ru preset; prompt rule for Latvian names in Latin script; strip audio tags in lint.

## Voice shortlist for Gate S (all female, sampled on eleven_v4_turbo)
Listen: open `spike/samples/voices/index.html` (LV opening, RU opening, bilingual opening per voice). Files `spike/samples/voices/<Name>_{lv,ru,bi}.mp3`; metadata `spike/voices_samples.json`. STT intelligibility was identical for all nine, so choose by ear.

| Name | voice_id | Kind |
|---|---|---|
| Ilze | `4nP0MRk3S5Qj1fGfXf51` | LV library, young, calm/warm (used in all tests) |
| Baiba | `azBQdzUwIzEtXS9PGiGX` | LV library, calm/warm/mellow |
| Signe | `6H9DAoiqXpVkBN5eOmIS` | LV library, bright/upbeat |
| Elza | `Xi5LaSIxpOwjOzRqTEG1` | LV library, upbeat/playful |
| Marina (Anna-ru-0) | `ymDCYd8puC7gYjxIamPt` | RU, already in account, soft/clear; reads LV and bilingual too |
| Kate (Anna-ru-8) | `tOo2BJ74frmnPadsDNIi` | RU, in account, calm/friendly |
| Rina (Anna-ru-3) | `ycbyWsnf4hqZgdpKHqiU` | RU, in account, soft/clear |
| Alice / Sarah | `Xb7hH8MSUJpSbSDYk0k2` / `EXAVITQu4vr4xnSDxMaL` | premade multilingual, for contrast |

Library voices worked as TTS and agent voice without being added to the account (27 voices now, limit probably 30). An owner can withdraw a library voice; add the chosen one at WP8 if a slot is free. Only four LV-labelled female voices exist in the shared library (`spike/voices_shared_lv.json`; RU list `voices_shared_ru.json`).

## Method
- Synthetic caller: `scripts/el/voice-caller.ts` opens the agent websocket, TTS-generates the caller lines (pcm_16000), streams them in real time in 100 ms chunks with continuous silence between lines (like a live mic), records agent audio and events. Caller voices: Signe (LV), Kate (RU); Daniel (premade) in the first langswitch run.
- Client latency = end of caller speech audio (before padding silence) -> first agent audio chunk received locally. It includes network and the 100 ms tick. Server latency = `convai_ttf_audio_since_silence` from conversation metadata (turn-end wait + LLM time to first sentence + TTS TTFB).
- Sample sizes: client latency 4 LV + 4 RU turns per LLM (one call each); server latency 4 LV + 8 RU turns per LLM (the RU batch ran twice, only one run has client logs). p90 of such small n is about the maximum. Language switching: 3 calls (v3 twice, v4 once); run A completed 2 caller turns, B and v4 completed 3. Numbers: 22 + 18 TTS samples. Voices: 27 samples.
- Prompt: about 700 characters (Anna test persona, one short sentence of at most 15 words, language_detection rule), temperature 0.3, only `language_detection` as tool, no webhooks, empty first message for latency runs (caller speaks first) and the real bilingual greeting for langswitch runs, `max_duration_seconds` 60. The real 8-section prompt and tools will raise LLM cost and TTFB.
- Cost = `metadata.charging.llm_price` (LLM) and `platform_price` (voice) per call; `metadata.cost_fiat` is their sum.
- Doubts: small n; scopes `user_read`/`models_read` missing on the key; Haiku quality unmeasured beyond one conversation; eager turn-taking, RU->LV switching, numbers inside the agent and `asr.keywords` untested. The account also holds about 68 min of non-SCG agent calls since 2026-09-01 (`usage.ts --since 2026-09-01 --agent-prefix all`), which counts against the same plan; the SCG-only filter excludes them.
- Tools: `node scripts/el/voice-caller.ts --agent <id> --turns <json> --out <label> [--caller-voice <id>] [--caller-model eleven_v4_turbo] [--no-greeting 1]`; `node scripts/el/usage.ts [--since D] [--agent-prefix scg|all] [--agent-ids a,b] [--log WPn]` (default filter: agent names starting with `scg`; prints filtered and unfiltered totals) (keys via `scripts/env.ps1`). Probe scripts in `spike/*.ts` are kept as evidence.

## Gate S carry-forward (judge, 2026-10-03)
1. Test RU→LV switching, and RU callers who never ask to switch: LV ASR writes their Russian in Latin letters (langswitch_v3_A.log.json:78). Switch turns took 2.8-3.2 s.
2. The address matcher must handle Cyrillic ASR garbles such as «Иллюкса съела» (langswitch_v3_B.log.json:106); add `asr.keywords`.
3. Script for street names: Latin-script names were only heard on v3c, where they sounded accented; Cyrillic on v4 sounded right (q_agent_audio_stt.json:16,20). Decide the script in WP8 by ear.
4. Choose number normalisation (`src/lib/words.ts` exists); the transcript lint must parse numbers written as words.
5. Strip audio tags ([happy], [slow]) or set `expressive_mode:false`.
6. Tune the end-of-turn wait.
7. With auth on, the websocket closes with code 3000; the preflight must unlock.
8. Log usage before deleting any agent.
9. LLM $/min will be about 2-3× higher with the real prompt (conv_langswitch_v4.json:96-99).
10. About 7.9k TTS characters and the EL Tests are unmetered; the API key lacks `user_read`.
11. LV numbers are untested inside the agent (`text_normalisation_type: system_prompt`), and date endings need an ear check.
12. STT heard the masculine «asistentu» in 27 of 27 opening samples: check by ear at H2/H3.
