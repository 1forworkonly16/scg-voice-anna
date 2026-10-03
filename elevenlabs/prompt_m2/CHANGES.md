# prompt_m2 vs live M1 prompt (WP11, staged for WP13)

Diff base: `elevenlabs/prompt/system_prompt.md` (M1, 83 lines) → `elevenlabs/prompt_m2/system_prompt.md` (119 lines). Line numbers are M1 → M2. Every other line is byte-identical (no trailing newline, as in M1). Check with `diff elevenlabs/prompt/system_prompt.md elevenlabs/prompt_m2/system_prompt.md`.
Aligned with WP12's final contract (`docs/tool_contract.md` L69-84, `src/contract/schemas.ts` L199-227, `src/copy/phrases_m2.ts`) in rework round 1.

## Changed or added lines
| M1 → M2 | Section | Change | Scenario |
|---|---|---|---|
| 3 → 3 | §1 | capability line: + tickets for leaks/damage/complaints, + messages from companies, job seekers, others | 4, 7 |
| 4 → 4 | §1 | are-you-human: + EN line | 6 |
| 8 → 8 | §2 | + «English is for callers who speak English, often companies from Sweden or Norway» | 6 |
| — → 10 | §2 | NEW: switch to English via `language_detection`; single English words / company names don't count | 6 |
| 12 → 13 | §2 | «Other languages»: now say in English that Anna helps in LV, RU or EN | 6 |
| — → 14 | §2 | NEW: English has no tool text; never translate prices, dates, slots, schedules; §6 facts may be said in English; fixed EN confirmation line | 6 |
| — → 25 | §3 | NEW: danger to people, then running water, come first (112 line or safety line) | 4, 5 |
| 30 → 33 | §4 A.4 | + LV manager question; + self-managed association: don't assume a manager | 2 |
| 44 → 47 | §4 D | unknowns also go into `summary_ru` of a request | 4–7 |
| 47 → 49–54 | §4 E | REWRITTEN «Leak right now»: E.1 NEW 112 line (RU/LV/EN, user decision) only for danger to people, never for an ordinary leak; E.2 = M1 safety line verbatim; E.3 «does SCG work in your building?» (RU/LV); E.4 → F or G; emergency number asked → «это уточнит наш менеджер», never a number | 4, 5 |
| — → 56–67 | §4 F | NEW ticket flow: one question «Что и где течёт, и течёт ли прямо сейчас?»; F.3 honest `type`/`urgency` rules (urgent only for running water/flooding, other apartments, electrics, danger; a slow drip is normal; stain or stopped drip = warranty); F.4 `create_ticket` args incl. optional `apartment`, description says «сейчас не течёт» when true, no phone before the ticket; F.5 `scg_site` false; F.6 callback after a ticket or request = `request_callback` with read-back and consent (RU/LV/EN), EN asks for the country code | 4 |
| — → 69–70 | §4 G | NEW: non-client emergency → `log_request` kind emergency_referral right after the safety line; relay `say_*` (may skip the repeated safety advice); inspection → flow A, call back → F.6 | 5 |
| — → 72–74 | §4 H | NEW: co-financing triggers (RU/LV) → §6 line verbatim → inspection offer (RU/LV); follow-ups → §D | 2 |
| — → 76–82 | §4 I | NEW: b2b / job_candidate / admin_message / other → ≤ 4 questions → `log_request` → call back via F.6; no names; no promises of crews, rates, vacancies | 6, 7 |
| 50 → 85 | §5 | + EN fillers | 6 |
| 51 → 86 | §5 | + «In English follow section 2» | 6 |
| 53 → 88 | §5 | + pass `language` ru/lv/en | 6 |
| 54 → 89 | §5 | confirm also ticket / request only after `ok: true` | 4–7 |
| 55 → 90 | §5 | never repeat a successful ticket or request | 4–7 |
| 56 → 91 | §5 | + EN goodbye | 6 |
| — → 103 | §6 | NEW fact: subcontractor in Latvia, Sweden, Norway; plumbers, fitters, welders, ventilation, insulation crews; no projects or clients [S01][S03], `info/01_company_profile.md` L20, L66 | 6, 7 |
| 70 → 106 | §7 | + LV banned «par pusi cenas» (the copy-lint form) | 2 | <!-- copy-lint:ignore (names the banned phrase) -->
| 71 → 107 | §7 | + «Never say that Riga pays for the works, or for part of them» | 2 |
| 75 → 111 | §7 | data minimisation: name only for a booking; only the phone for a callback (tickets and requests take neither) | 4–7 |
| — → 115 | §7 | NEW: never say or guess an emergency phone number; 112 only when people are in danger (flow E) | 5 |

The §6 co-financing line (RU + LV, «сданных в эксплуатацию в 2001 году или раньше» / «nodotas ekspluatācijā 2001. gadā vai agrāk», [S34], `info/04_market_and_regulation.md` L30) is unchanged from M1; flow H only routes to it.

## Contract alignment (rework round 1)
- **No phone or consent on the new tools** (orchestrator decision): removed from the prompt, `tool_descriptions_m2.json` and every spec. A call back after a ticket or request always goes through `request_callback` (F.6).
- **Mismatches resolved:**
  - `create_ticket.type`: my `damage` and `other` do not exist. Damage is now `complaint` (WP12 describes it as «complaint (damage, mess, noise)»). A stain or stopped drip after works is now `warranty`. `other` was dropped.
  - `urgency` (`normal` / `urgent`) and `log_request.kind` (`b2b` / `job_candidate` / `emergency_referral` / `admin_message` / `other`) already matched. `other` is now used in flow I.
  - New optional `apartment` (integer) added to F.4, the descriptions and t30/t31.
  - Spec mocks now carry `replayed`, ids in WP12 form (`T-xxxxxx`, `R-xxxxxx`), and `say_*` copied from `phrases_m2.ts` (`ticket_urgent`, `ticket_ok`, `request_ok`, `request_emergency_referral`).
- **Escalation honesty:** WP12 escalates on `type: leak`, on `urgency: urgent`, or on a non-negated leak word (`src/lib/ticket.ts`). F.3 keeps `urgent` for real emergencies and sends a stain or stopped drip to `warranty`/`normal`. **Residual for WP12/WP13:**
  - Any `type: leak` still escalates. The schema says «A leak is always treated as urgent», so a slow active drip escalates even with `urgency: normal`.
  - A description like «пятно после протечки, сейчас не течёт» still matches «протечк» without a negation before it.
- **Foreign phone numbers:** `normalizePhone` (`src/lib/phone.ts`) accepts them as `+<country><8–15 digits>` or `00<country>…` (e.g. +46701234567), so `request_callback` takes them. A Swedish number without a country code (070…) is rejected as `invalid_phone`, which is why F.6 asks English callers for the country code. **WP13 item:** the zod `phone` describe text still says «digits with optional +371». Consider rewording it to «with country code if not Latvian».

## Other WP13 items
1. The ElevenLabs language config needs `en` (preset from `presets_en.json`), and `language_detection` gets the description in `tool_descriptions_m2.json`.
2. `request_callback.reason` is free text. The new values `leak_ticket`, `ticket`, `b2b`, `job_candidate`, `emergency_referral` and `admin_message` need no schema change.
3. `scripts/el/tests.ts`:
   - It writes the filler «Секунду, проверяю.» into every tool call in history.
   - It adds a note on Latvian names in Russian text to every success condition.
   - `relayArgs()` has no defaults for the new tools. That only matters if a spec gets `reply_must` with a mock; none do.
4. The specs in `elevenlabs/test_specs_m2/` (12, 5 critical) move to `elevenlabs/test_specs/` at merge.

## WP8 prompt fix round 2 (2026-10-03), mirrored from M1
Both prompts got the same edits, so the shared lines stay byte-identical. The table above uses pre-round-2 line numbers: from here on M1 is +1 after L24 and M2 is +1 after L27.
- §2 L9 (both): call `language_detection` BEFORE the first word in the new language, in both directions; going back to Latvian after Russian also needs the call (lv), even though Latvian is the default.
- §4 new routing line (M1 L25, M2 L28): a resident asking about works (when, water off, access, schedule, not being home) → flow B and `find_works_schedule`; `lookup_building` only for an inspection or a price.
- A.3 (M1 L30, M2 L33): pass apartments only if the caller said the number or `lookup_building` returned it; otherwise ask «Сколько примерно квартир в доме?» / «Cik aptuveni dzīvokļu ir mājā?».
- C (M1 L42, M2 L45): when the caller says yes to consent, the very next action is `request_callback`; the name is optional, never ask for it.
- M1 §7 L76 now carries M2's data-minimisation wording (name only for a booking; only the phone for a callback), so the row «75 → 111» above is no longer a difference.
- `tool_descriptions_m2.json` `language_detection`: + «Call it BEFORE your first word in the new language, in every direction (Latvian, Russian, English); going back to Latvian, the default, also needs this call with lv».
- Contract descriptions (`src/contract/schemas.ts`, shared by M1 and M2): lookup_building, quote_range, find_works_schedule, request_callback, the `apartments` param (no «e.g. 144») and the `phone` param («digits only without spaces, with optional +371»). The WP13 item on the phone text for foreign numbers still stands.
