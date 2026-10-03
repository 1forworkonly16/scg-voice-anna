# Tool contract (M1), version 1

Single source: `src/contract/schemas.ts` (zod v4). `toElevenLabsTool(name, {baseUrl, secretId})` in `src/contract/elevenlabs.ts` emits the ElevenLabs webhook-tool definition; `tests/unit/__snapshots__/contract.test.ts.snap` pins it. This file is written from the schemas and a test keeps tool, field and error names in step.

## Transport
- `POST {base_url}/tools/<name>`, JSON body, header `x-scg-key: <secret>` (ElevenLabs workspace secret `{secret_id}`). Wrong or missing key: HTTP 401 only.
- Every other outcome is HTTP 200 with the envelope below, so the agent always has a sentence to say.
- `channel` (voice now, web later) is derived from which key was used, not from the body.

## Request base (every tool)
| Field | Type | Notes |
|---|---|---|
| `conversation_id` | string | Bound to the platform variable `system__conversation_id` (`dynamic_variable`); the agent never fills it |
| `language` | `ru` / `lv` / `en` | Language the caller speaks now |

## Response envelope
Success: `{ ok: true, v: 1, say_ru, say_lv, hint, ...fields }`. Error: `{ ok: false, v: 1, say_ru, say_lv, hint, error: { code, message? }, alternatives? }`.
`say_*` come from the phrase templates (`src/copy/phrases.ts`, filled by `src/lib/render.ts`); the agent reads `say_<language>` aloud and follows `hint`. Prices, dates and times are produced by code only.

Error codes: `invalid_input`, `invalid_slot`, `slot_taken` (carries `alternatives`, at most 2 slots), `invalid_phone`, `consent_required`, `calendar_down`, `not_found`, `invalid_reschedule`, `internal_error`.

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
- In: all optional: `weekday` (`mon`..`fri`), `date_from`, `date_to` (YYYY-MM-DD), `part_of_day` (`morning` / `afternoon`).
- Out: `today` (`date`, `label_ru`, `label_lv`), `office_open_now`, `slots` (at most 3), `filter_relaxed` (true when the filter left fewer than 3 and others were added).
- Rules: Mon-Fri, 1-hour slots starting 09:00-16:00 Europe/Riga, Latvian public holidays excluded, earliest is the next working day, horizon 14 days.
- Side effects: freeBusy read.

### `book_inspection`
- In (required): `slot_start`, `address_spoken`, `floors`, `stairwells`, `apartments`, `caller_role` (`owner` / `manager` / `board_member` / `tenant` / `other`), `name`, `phone`, `consent` (true).
- In (optional): `building_id`, `scope`, `notes` (no names or phones), `unknown_questions` (at most 5).
- Out: `booking_id`, `slot`, `address`, `replayed`.
- Errors: `slot_taken` (+ `alternatives`), `invalid_slot`, `invalid_phone`, `consent_required`, `calendar_down`.
- Side effects: Calendar event written synchronously (id = first 32 hex of SHA-256 of `conversation_id|inspection`, so a replay is idempotent); Leads row and Telegram message afterwards.

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
- In: `reason`, `summary_ru` (no names or phones), `phone`, `consent` (true); optional `name`.
- Out: `callback_id`.
- Errors: `invalid_phone`, `consent_required`.
- Side effects: Callbacks row, Telegram message. Replaces brief A's `handoff(summary)`.

## M2 (not built)
TODO: `create_ticket` (type, urgency, description, address) and `log_request` (kind, summary_ru).

## Phrase keys used for `say_*`
`price_range`, `building_found`, `building_confirm`, `building_need_house`, `building_not_found`, `slots_offer`, `no_slots`, `booking_ok`, `slot_taken`, `invalid_phone`, `calendar_down`, `works_found`, `works_not_found`, `access_rescheduled`, `callback_ok`, `tool_error_generic`, `unknown_question`. Placeholder sets are fixed in `PHRASE_SPEC` (`src/lib/render.ts`).
