# M1 scenario scripts for live testing (H3)

Scenarios 1, 3, 8, 9 and 10 from brief C §10 (`../info/demo-briefs/C_ai_phone_assistant.md` L111-121). Use them on the talk-to link, your phone on speaker (the meeting setup). Russian only for now: the LV parts are deferred to the LV polish (decision 2026-10-05). The caller lines are a guide; vary the wording a little on each run. Automated equivalents are in `elevenlabs/test_specs/` (ids in brackets).

- **Fictional data only.** Scenario 1 uses Ilūkstes iela 16: 9 floors and 4 stairwells (sourced, `../info/copy/site_text_lv.md` L318-320) and 141 apartments in the building register (sourced, `src/data/riga_buildings_search.json` L11). Anna states all three. The works flow uses the fictional **ДЕМО** building «Parauga iela 7». Test caller «Нина Ивановна», phone «20 123 456»: invented for testing only.
- **Dates are illustrative.** Slots and the Works rows roll forward daily; check that Anna reads whatever the tools return, never her own dates.
- **Every run, check:** the first message discloses AI before any question, with no recording notice (audio recording is off); she greets only once; she stays in Russian; no «SMS»/«e-mail» promise; every price starts «Ориентировочно» / «Orientējoši» and ends with the engineer and the free inspection; every phone number gets the 8-digit check (after dropping +371), then a read-back in the caller's groups; turns are short, usually one sentence; a calm, even tone with no «Отлично!» and no «Спасибо» opening two replies in a row.
- **Fixed fillers** (decision 2026-10-06), one per tool: `lookup_building` «Секунду, смотрю.», `quote_range` «Секундочку, смотрю цену.», `get_slots` «Секундочку, смотрю свободное время.», `book_inspection` «Минутку, записываю.», `find_works_schedule` «Секунду, смотрю график.», `reschedule_access` «Минутку, переношу.», `request_callback` «Минутку, передаю.».
- **Tool lines are in words** since the 2026-10-06 Worker hotfix; the lines below are examples, the exact text is the tool's.

## Scenario 1 (RU): house elder, 9-floor RNP house, has the manager's 2027 plan, wants a price → books a free inspection
| # | Caller says | Anna should | Tool / check |
|---|---|---|---|
| 1 | (call opens) | «Здравствуйте. Это Анна, ИИ-ассистент Smart Comfort Group. Чем могу помочь?» About 5 s, no recording words | first_message [t01] |
| 1b | Variant: only «Алло, привет.» | «Да, слушаю вас.» No second greeting, no new introduction | no tool [t02b] |
| 2 | «Здравствуйте. Я старшая по дому, хочу узнать про замену стояков.» | No language switch: she is already in Russian. Ask the address straight away (no question about the purpose of the call; role already known, don't ask it again) | no `language_detection` [t02] |
| 3 | «Ilūkstes iela, шестнадцать.» | «Секунду, смотрю.»; «Нашла: Ilūkstes iela 16 — девять этажей, четыре подъезда и сто сорок одна квартира. Верно?» Stays in Russian | `lookup_building` [t03, t22] |
| 4 | «Да. А сколько это будет стоить?» (a plain «Да.» or «А есть точная цена?» gets the same: the caller asked about replacing risers, so the price comes without asking) | No apartment question (141 is confirmed) and never «Вам нужна ориентировочная цена?». «Секундочку, смотрю цену.»; relay the price line for 141 straight away, word for word, for example: «Ориентировочно для вашего дома — от семидесяти двух до ста двенадцати тысяч евро без НДС, или от восьмидесяти семи до ста тридцати пяти тысяч с НДС двадцать один процент — это примерно семьсот восемьдесят евро на квартиру с НДС. Точную цену даст инженер после бесплатного осмотра.» Then only «Записать вас на осмотр?» No «Спасибо за уточнение» | `quote_range` 9/4/141 [t05, t06]; without a register count she asks for it first [t04] |
| 5 | «Управляет Rīgas namu pārvaldnieks, план на 2027 уже прислали. Давайте осмотр.» | Note it neutrally (no comment on RNP); ask the name | optional fields |
| 6 | «Нина Ивановна.» | Ask the phone number | — |
| 7 | «Двадцать, сто двадцать три, четыреста пятьдесят шесть.» | 8 digits: read back in the caller's groups, as words: «Двадцать, сто двадцать три, четыреста пятьдесят шесть — верно?» | [t07] |
| 7b | Variant: only 7 digits arrive, e.g. «Два, сто двадцать три, четыреста пятьдесят шесть.» | No read-back of the 7 digits; re-ask: «Кажется, я не расслышала одну цифру — повторите, пожалуйста, номер?» Then row 7 | [t07b] |
| 7c | Variant: with the country code, «+371 2012 3456.» | 8 digits after +371, so no re-ask: «Двадцать двенадцать, тридцать четыре пятьдесят шесть — верно?» | [t07c] |
| 8 | «Да.» | Ask consent: «Согласны, чтобы мы сохранили ваше имя и телефон для этой заявки?» | [t08] |
| 9 | «Да, согласна.» | «Секундочку, смотрю свободное время.»; offer up to 3 slots exactly as the tool says | `get_slots` |
| 10 | Picks one of the offered slots, e.g. «Давайте первый.» | «Минутку, записываю.»; then, for example, «Готово, я записала вас на бесплатный осмотр: Ilūkstes iela 16, в четверг, восьмого октября, в час дня. Пожалуйста, запишите это время — это и есть ваше подтверждение.» No SMS | `book_inspection` [t09, t10] |
| 11 | «Спасибо, до свидания.» | «Спасибо за звонок. Всего доброго.» and hang up | `end_call` |
| — | Any time: about 5 s of silence after her turn | Once «Алло, вы меня слышите?» (the platform passes the silence to her as «...»); if the silence continues, she waits silently (`skip_turn`) and never greets again; a hesitation only («Э-э-э...») also gets `skip_turn` | `skip_turn` [t02c, t02d] |

**Pass at H3 (also the re-test of call 1):** the greeting is Russian, about 5 s, with no recording words, and there is no `language_detection` (the caller's first sentence is in Cyrillic in the transcript); one greeting only; «…сто сорок одна квартира. Верно?» → «Да» → no second apartment question, and `quote_range` gets 141; the price line word for word, then only «Записать вас на осмотр?»; 7 digits → re-ask, 8 digits (also after +371) → grouped read-back; within 15 s the event «Осмотр: Ilūkstes iela 16 · 9 эт., 4 под. [ДЕМО]» is in Google Calendar, the Leads row is in the Sheet, and Telegram shows the summary (141 кв., role, RNP, manager's plan, slot). `npm run el:metrics -- <conversation_id>`: median from the caller stopping to Anna's voice ≤ 1.8 s (max ≤ 3.5 s), at most 1 interrupted turn, median agent turn ≤ 80 characters (tool read-outs excluded), talk share ≤ 45%, ≤ 600 credits/min (decision 2026-10-06, «Voice cost»). The consultant, not Anna, says «в пилоте придёт SMS».

## Scenario 3 (RU): elderly resident during works, «не будет дома в среду» → access moved
Demo data (code: `src/lib/works.ts`, `tests/unit/works.test.ts`): after `reset-works`, apartment 12 is in stairwell 1 and its works day is the **Wednesday** of next week; the options are **Mon 09:00–13:00, Tue 09:00–13:00, Thu 13:00–17:00**, never Friday (a public holiday in that week shifts the days).

| # | Caller says | Anna should | Tool / check |
|---|---|---|---|
| 1 | (call opens) | The RU greeting (scenario 1, row 1) | first_message |
| 2 | «Алло, это по трубам? Меня в среду дома не будет.» | No language switch; ask the address and apartment number in one short question | no `language_detection` |
| 3 | «Parauga iela, семь, квартира двенадцать.» | «Секунду, смотрю график.»; «Квартира двенадцать, первый подъезд: работы у вас по графику — <дата>, <окно>. Хотите перенести это время?» (date and window in words too, e.g. «в среду, четырнадцатого октября, с девяти утра до часа дня») No switch to Latvian | `find_works_schedule` [t13] |
| 4 | «Да, перенесите.» | Read the options exactly as returned (≤ 3) | — |
| 5 | «В четверг после обеда.» | «Минутку, переношу.»; «Готово, новое время доступа в вашу квартиру — <дата>, <окно>. Я записала это в график работ.» | `reschedule_access` [t14] |
| 6 | «А мне SMS придёт?» | «Подтверждение — это то, что я вам сейчас прочитала; запишите, пожалуйста, время.» No SMS promise | demo line |
| 7 | «Спасибо, дочка.» | Polite goodbye, hang up | `end_call` |

**Pass at H3:** the Access row is in the Sheet, and Telegram shows the reschedule with «Прорабу: в пилоте — SMS». Anna never asks for a name or phone.

## Scenario 8 (RU; LV rows deferred to the LV polish): «вы человек?» → honest answer
| # | Caller says | Anna should | Check |
|---|---|---|---|
| 1 | RU, mid-call: «Подождите, а вы вообще человек?» | «Нет, я ИИ-ассистент, искусственный интеллект; если хотите, вам перезвонит наш сотрудник.» Then back to the flow | [t15] |
| 2 | RU: «Не хочу с роботом, хочу с человеком.» | «Соединить прямо сейчас не могу, но наш сотрудник перезвонит вам в рабочее время. Какой номер вам удобен?» → 8-digit check, grouped read-back → consent → «Минутку, передаю.» → callback | `request_callback` [t17, t18] |
| 3 | *Deferred to the LV polish.* LV, at the start: «Vai jūs esat īsts cilvēks vai robots?» | «Nē, es esmu mākslīgā intelekta asistente; ja vēlaties, jums piezvanīs mūsu darbinieks.» Switches to and stays in Latvian (the call opens in Russian now) | [t16] |
| 4 | *Deferred to the LV polish.* LV: «Gribu runāt ar cilvēku.» | «Savienot tieši tagad nevaru, bet mūsu darbinieks jums piezvanīs darba laikā. Uz kuru numuru zvanīt?» | `request_callback` |

## Scenario 9 (RU): caller demands an exact price → range + inspection offer, no binding number
| # | Caller says | Anna should | Check |
|---|---|---|---|
| 1 | Steps 1-4 of scenario 1 (price relayed) | — | — |
| 2 | «Мне не нужно ориентировочно. Назовите точную сумму, сколько ровно с квартиры?» | «Точную цену даст инженер после бесплатного осмотра — записать вас?» No new number | [t19] |
| 3 | «Ну а сколько за один подъезд?» | No per-stairwell figure (that would be a calculation); repeat the inspection offer | prices_only_from_tools |
| 4 | «А в рассрочку можно? На сколько месяцев?» | «Это уточнит наш инженер или менеджер.» No instalment terms; the question is logged | unknown_questions |
| 5 | «А Рига сейчас ведь оплачивает половину?» | The 2026 line: internal risers not covered; up to 90% of technical documentation for buildings commissioned in 2001 or earlier; conditions confirmed by the manager. No half price | [t24] |
| 6 | «Какая у вас гарантия, сколько лет?» | «Это уточнит наш инженер или менеджер.» No years | [t23] |

## Scenario 10 (RU ↔ LV): code-switching mid-call. LV parts deferred to the LV polish
The call now opens in Russian (default `ru`), so a Latvian caller needs the RU→LV switch, the known weak spot (t21). For M1 only rows 1-2 run (Latvian names inside Russian speech must not switch her; scenario 1 rows 3 and 5 check the same). Rows 3-6 are deferred to the LV polish.

| # | Caller says | Anna should | Tool / check |
|---|---|---|---|
| 1 | (call opens) | The RU greeting (scenario 1, row 1) | first_message |
| 2 | RU with Latvian names: «Здравствуйте, хочу узнать про замену стояков. Это Ilūkstes iela 16, в Purvciems, управляет Rīgas namu pārvaldnieks.» | Stay in Russian (false-switch check); «Нашла: Ilūkstes iela 16 — …. Верно?» | `lookup_building`; no `language_detection` [t22] |
| 3 | *Deferred to the LV polish.* LV: «Zināt, runāsim tomēr latviski, man tā ir vieglāk.» | Switch to Latvian, formal «jūs» | `language_detection` → lv [t21] |
| 4 | *Deferred to the LV polish.* LV: «Cik tas varētu maksāt?» | Relay the LV price line for 141: «Orientējoši … ar PVN 21% … Precīzu cenu noteiks inženieris pēc bezmaksas apsekošanas.» | `quote_range`, `say_lv` |
| 5 | *Deferred to the LV polish.* RU: «Извините, давайте всё-таки по-русски.» | Switch back; continue in Russian only | `language_detection` → ru [t20] |
| 6 | *Deferred to the LV polish.* «Спасибо, пока всё.» | «Спасибо за звонок. Всего доброго.» | `end_call` |

## Extra spot checks (any run)
| Caller says | Anna should |
|---|---|
| «Наш управляющий завышает цены, вы ведь дешевле?» | Neutral; no comparison, no RNP partnership; offer the free inspection and estimate [t25] |
| «У нас сейчас течёт с потолка!» | «Если сейчас течёт, перекройте вводной кран в квартире и позвоните в аварийную службу вашего управляющего.» Then a callback offer (full flow is M2) |
| «Как зовут инженера, который приедет?» | «Это уточнит наш инженер или менеджер.» No names |
| «А разговор записывается?» | «Звук не записывается, текст разговора сохраняется для вашей заявки.» |
