# Tool contract (M1 + M2 backend), version 1

Single source: `src/contract/schemas.ts` (zod v4). `toElevenLabsTool(name, {baseUrl, secretId})` in `src/contract/elevenlabs.ts` emits the ElevenLabs webhook-tool definition; `tests/unit/__snapshots__/contract.test.ts.snap` pins it. This file is written from the schemas and a test keeps tool, field and error names in step.

## Transport
- `POST {base_url}/tools/<name>`, JSON body, header `x-scg-key: <secret>` (ElevenLabs workspace secret `{secret_id}`). Wrong or missing key: HTTP 401 only.
- Every other outcome is HTTP 200 with the envelope below, so the agent always has a sentence to say.
- `channel` (voice now, web later) is derived from which key was used, not from the body.

## Configuration (Worker vars in `wrangler.jsonc`)
- `TOOLS_ENABLED`: comma list of the tools that may be called; live runs the 7 M1 tools. A tool that is not listed gets exactly the answer of an unknown tool name (HTTP 200, `invalid_input`, hint «Unknown tool name.»); only the log says why (`tool_disabled`). Nothing is read, written or sent. Unset, empty or without a name: every tool works. The key check comes first (a bad key is 401 for every name). WP13 adds `create_ticket` and `log_request` when it wires them into the agent.
- `RU_STREET_SPOKEN`: `latin` (default, also when unset or any other value) or `cyrillic`. With `cyrillic` only `say_ru` speaks a street address as Russian words: «Ilūkstes iela 16» becomes «улица Илукстес, дом шестнадцать», «Tirzas iela 3 k-2» «улица Тирзас, дом три, корпус два»; `gatve` stays «гатве», `prospekts` is «проспект», `bulvāris` «бульвар». It covers every address or street placeholder in `say_ru`: `building_found`, `building_confirm`, `building_need_house`, `booking_ok`. `say_lv`, the structured fields (`building.address`, `street`, `address`), the Leads row, the Calendar event and Telegram keep the Latin address. The streets of the building list (and «Parauga iela») use the reviewed map in `src/lib/street_ru.ts`, other streets are transliterated letter by letter, house and korpuss numbers are words; an address already in Cyrillic is left as given.

## Request base (every tool)
| Field | Type | Notes |
|---|---|---|
| `conversation_id` | string | Bound to the platform variable `system__conversation_id` (`dynamic_variable`); the agent never fills it |
| `language` | `ru` / `lv` / `en` | Language the caller speaks now |

## Response envelope
Success: `{ ok: true, v: 1, say_ru, say_lv, hint, ...fields }`. Error: `{ ok: false, v: 1, say_ru, say_lv, hint, error: { code, message? }, alternatives? }`.
`say_*` come from the phrase templates (`src/copy/phrases.ts`, filled by `src/lib/render.ts`); the agent reads `say_<language>` aloud and follows `hint`. Prices, dates and times are produced by code only.

Error codes: `invalid_input`, `invalid_slot`, `slot_taken` (carries `alternatives`, at most 2 slots), `invalid_phone`, `calendar_down`, `not_found`, `invalid_reschedule`, `internal_error`. The `invalid_phone` hint (`book_inspection`, `request_callback`): ask the caller to repeat the number, check the 8 digits, then read it back in the caller's groups.

Contact data (decision 2026-10-06): `book_inspection` and `request_callback` take no consent input; the basis for storing the name and phone is the caller's own request (GDPR Art. 6(1)(b)), and Anna's phone question says what the number is for. The Sheet's `consent` column (Leads, Callbacks) records that basis as `request`. A stale `consent` key in a call is stripped by zod.

Slot object: `{ start (ISO 8601 with Europe/Riga offset), label_ru, label_lv }`.
Building object: `{ id, address, floors, stairwells, apartments (each int or null), sourced[] }`. Only fields listed in `sourced` may be spoken.

## Tools
Timeouts on the ElevenLabs side: 10 s for `book_inspection`, 8 s for the others.

### `lookup_building`
- In: `address` (string, as spoken).
- Out: `status` (`found` / `confirm` / `need_house` / `not_found`), `confidence` (0..1), `building` (or null), `candidates` (at most 3), `street` (or null).
- Side effects: none.

### `quote_range`
- In: `floors`, `stairwells`, `apartments` (integers); optional `scope` (`risers_complete` default, `risers_water_only`, `risers_sewer_only`, `risers_kitchen_only`, `heating_risers`), `horizontals` (default true), `sewer_outlet`, `pump_station`, `options` (`opt_sound_fire_wrap`, `opt_new_towel_rail`).
- Out: `model_version`, `range` (`low`/`base`/`high`, each `{net, gross}`), `per_apartment_gross`, `figures` (`low_net`, `high_net`, `low_gross`, `high_gross`, `per_apt_gross`: the only numbers to speak).
- Never output: instalments, working days. Always «ориентировочно», net and incl. VAT 21%.

### `get_slots`
- In: all optional: `weekday` (`mon`..`fri`) and `part_of_day` (`morning` / `afternoon`), only as the caller named them. `date_from`, `date_to` (YYYY-MM-DD) are still accepted by the Worker, but their descriptions tell the agent to leave them empty: dates are never computed from «завтра», a weekday or a spoken date.
- Out: `today` (`date`, `label_ru`, `label_lv`), `office_open_now`, `slots` (at most 3), `filter_relaxed` (true when the filter left fewer than 3 and others were added).
- Rules: Mon-Fri, 1-hour slots starting 09:00-16:00 Europe/Riga, Latvian public holidays excluded, earliest is the next working day, horizon 14 days.
- Side effects: freeBusy read.

### `book_inspection`
- In (required): `slot_start`, `address_spoken`, `floors`, `stairwells`, `apartments`, `caller_role` (`owner` / `manager` / `board_member` / `tenant` / `other`), `phone` (the 8 digits Anna read back, optional +371).
- In (optional): `name` (only if the caller gave one; empty or blank counts as absent and is shown as «—» in the Leads row, the Telegram text and the Calendar description), `building_id`, `scope`, `notes` (no names or phones), `unknown_questions` (at most 5).
- Out: `booking_id`, `slot`, `address`, `replayed`.
- Errors: `slot_taken` (+ `alternatives`), `invalid_slot`, `invalid_phone`, `calendar_down`.
- Side effects: Calendar event written synchronously (id = first 32 hex of SHA-256 of `conversation_id|inspection`, so a replay is idempotent); Leads row (`consent` = `request`) and Telegram message afterwards.
- Re-booking: a second call in the same conversation with another free slot moves the same event (PATCH, never a second one), answers `ok` with the new slot and sends the «Перенос осмотра» Telegram; the Leads row is not rewritten (it keeps the first slot). The same slot again is a replay (`replayed: true`). A slot someone else holds is `slot_taken` and the event stays. Tests: `tests/worker/booking.test.ts`, `booking_409.test.ts`.

### `find_works_schedule`
- In: `apartment`; `address` or `building_id`.
- Out: `found`, `building_id`, `stairwell`, `date`, `window`, `rescheduled`, `options` (at most 3, each `{date, window, label_ru, label_lv}`).
- Demo data only (fictional «Parauga iela 7», ДЕМО).

### `reschedule_access`
- In: `building_id`, `apartment`, `new_date`, `new_window` (`09:00-13:00` or `13:00-17:00`).
- Out: `access_id`, `date`, `window`.
- Errors: `not_found`, `invalid_reschedule`.
- Side effects: Access row, Telegram message.

### `request_callback`
- In: `reason`, `summary_ru` (no names or phones), `phone` (called right after the caller confirmed the read-back); optional `name`.
- Out: `callback_id`.
- Errors: `invalid_phone`.
- Side effects: Callbacks row (`consent` = `request`), Telegram message. Replaces brief A's `handoff(summary)`.

## M2 tools (backend built, not yet wired into the agent: WP13)
`create_ticket` and `log_request` live in the same zod source and Worker, but the live agent still has the 7 M1 tools until `npm run el:tools` / `el:build` run in WP13, and live keeps the two tools switched off with `TOOLS_ENABLED` until then. Phrases: `src/copy/phrases_m2.ts` (6 keys: `ticket_ok`, `ticket_urgent`, `ticket_urgent_other`, `ticket_alert_failed`, `request_ok`, `request_emergency_referral`). Neither tool takes a name or phone number; the agent takes a number only through `request_callback`.
Both tools: id derived from `conversation_id`, so a re-sent call returns the stored result with `replayed: true` and writes nothing; `[TEST]` conversations are flagged `is_test` and notify only `TELEGRAM_TEST_CHAT_ID`; free text has phone-like digit runs replaced by `[номер скрыт]`.

Known limitation (accepted for the demo): the replay check reads the tab before it appends, so two identical calls from the same conversation at the same instant can both write a row (and send two alerts). Sequential retries are safe.

### `create_ticket`
- In (required): `type` (`complaint` / `warranty` / `maintenance` / `leak`), `urgency` (`normal` / `urgent`), `description` (Russian, no names or phones), `address` (as spoken); optional `apartment` (integer).
- Out: `ticket_id` (`T-` + 6 hex of SHA-256 of `conversation_id|ticket|type|urgency`), `scg_site` (true: the matched building is in the Works tab; false: matched but not on the list; null: address not matched or Sheet unreachable), `escalated`, `replayed`.
- Escalation: a `leak` type, a leak word in the description (ru/lv/en safety net; a negation within 2 words before it, e.g. «не течёт», «nav sūces», cancels the match), or `urgency: urgent` sets `escalated` true and sends the «СРОЧНО» Telegram alert; otherwise a plain notice. The alert shows `Дежурный мастер: [уточнить]` (on-call contact is unknown, never invented). Speech: `ticket_urgent`; `ticket_urgent_other` when `scg_site` is false (refer to the manager's emergency service); `ticket_alert_failed` when the alert was not delivered.
- Side effects: Tickets row (`escalated`, `scg_site` as TRUE/FALSE/empty) and Telegram, in parallel. Sheet read failure only makes `scg_site` null and disables the replay check.
- Errors: `invalid_input`, `internal_error` (Sheet and Telegram both failed).

### `log_request`
- In: `kind` (`b2b` / `job_candidate` / `emergency_referral` / `admin_message` / `other`), `summary_ru` (no names or phones).
- Out: `request_id` (`R-` + 6 hex of SHA-256 of `conversation_id|request|kind`), `replayed`.
- Side effects: Requests row and a short Telegram notice. `emergency_referral` speaks `request_emergency_referral` (valve + the manager's emergency service; no transfer, no visit promised).
- Errors: `invalid_input`, `internal_error`.

## Phrase keys used for `say_*`
`price_range`, `building_found`, `building_confirm`, `building_need_house`, `building_not_found`, `slots_offer`, `no_slots`, `booking_ok`, `slot_taken`, `invalid_phone`, `calendar_down`, `works_found`, `works_not_found`, `access_rescheduled`, `callback_ok`, `tool_error_generic`, `unknown_question`, `invalid_reschedule`, `slots_offer_two`, `slots_offer_one` (20 keys), plus the 6 M2 keys above. Placeholder sets are fixed in `PHRASE_SPEC` (`src/lib/render.ts`).
