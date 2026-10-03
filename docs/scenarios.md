# M1 scenario scripts for live testing (H3)

Scenarios 1, 3, 8, 9 and 10 from brief C §10 (`../info/demo-briefs/C_ai_phone_assistant.md` L111-121). Use them on the talk-to link, phone on speaker. The caller lines are a guide; vary the wording a little on each run. Automated equivalents are in `elevenlabs/test_specs/` (ids in brackets).

- **Fictional data only.** Scenario 1 uses Ilūkstes iela 16 (9 floors, 4 stairwells: sourced, `../info/copy/site_text_lv.md` L318-320; 144 apartments is an assumption, so Anna must not state it). The works flow uses the fictional **ДЕМО** building «Parauga iela 7». Test caller «Нина Ивановна», phone «20 123 456»: invented for testing only.
- **Dates are illustrative.** Slots and the Works rows roll forward daily; check that Anna reads whatever the tools return, never her own dates.
- **Every run, check:** sentence 1 discloses AI + recording; no «SMS»/«e-mail» promise; every price starts «Ориентировочно» / «Orientējoši» and ends with the engineer and the free inspection; turns ≤ 2 sentences.

## Scenario 1 (RU): house elder, 9-floor RNP house, has the manager's 2027 plan, wants a price → books a free inspection
| # | Caller says | Anna should | Tool / check |
|---|---|---|---|
| 1 | (call opens) | «Labdien, Smart Comfort Group, jūs runājat ar mākslīgā intelekta asistenti Annu; saruna tiek ierakstīta. Kā varu palīdzēt? Можно по-русски.» | first_message [t01] |
| 2 | «Здравствуйте. Я старшая по дому, хочу узнать про замену стояков.» | Switch to Russian; ask the address (role already known, don't ask it again) | `language_detection` → ru [t02] |
| 3 | «Ilūkstes iela, шестнадцать.» | Short filler; «Нашла: Ilūkstes iela 16 — девять этажей, четыре подъезда. Верно?» Stays in Russian | `lookup_building` [t03, t22] |
| 4 | «Да. А сколько это будет стоить?» | Ask roughly how many apartments; no amount yet | no tool [t04] |
| 5 | «Сто сорок четыре.» | «Сто сорок четыре квартиры — верно?» | read-back |
| 6 | «Да.» | Filler; relay the price line word for word: «Ориентировочно … без НДС … с НДС 21% … на квартиру … Точную цену даст инженер после бесплатного осмотра.» Offer the inspection | `quote_range` 9/4/144 [t05, t06] |
| 7 | «Управляет Rīgas namu pārvaldnieks, план на 2027 уже прислали. Давайте осмотр.» | Note it neutrally (no comment on RNP); ask the name | optional fields |
| 8 | «Нина Ивановна.» | Ask the phone number | — |
| 9 | «Двадцать, сто двадцать три, четыреста пятьдесят шесть.» | Read back digit by digit: «два, ноль, один, два, три, четыре, пять, шесть — верно?» | [t07] |
| 10 | «Да.» | Ask consent: «Согласны, чтобы мы сохранили ваше имя и телефон для этой заявки?» | [t08] |
| 11 | «Да, согласна.» | Filler; offer up to 3 slots exactly as the tool says | `get_slots` |
| 12 | «Давайте в четверг в десять.» | Book; then «Готово, я записала бесплатный осмотр: Ilūkstes iela 16, <слот>. Пожалуйста, запишите это время — это и есть ваше подтверждение.» No SMS | `book_inspection` [t09, t10] |
| 13 | «Спасибо, до свидания.» | «Спасибо за звонок, всего доброго!» and hang up | `end_call` |

**Pass at H3:** within 15 s the event «Осмотр: Ilūkstes iela 16 · 9 эт., 4 под. [ДЕМО]» is in Google Calendar, the Leads row is in the Sheet, and Telegram shows the summary (role, RNP, manager's plan, slot). The consultant, not Anna, says «в пилоте придёт SMS».

## Scenario 3 (RU): elderly resident during works, «не будет дома в четверг» → access moved
| # | Caller says | Anna should | Tool / check |
|---|---|---|---|
| 1 | (call opens) | Bilingual opening | — |
| 2 | «Алло, это по трубам? Меня в четверг дома не будет.» | Switch to Russian; calmly ask the address and apartment number | `language_detection` → ru |
| 3 | «Parauga iela, семь, квартира двенадцать.» | Filler; «Квартира 12, подъезд 2: работы у вас по графику — <дата>, <окно>. Хотите перенести это время?» No switch to Latvian | `find_works_schedule` [t13] |
| 4 | «Да, перенесите.» | Read the options exactly as returned (≤ 3) | — |
| 5 | «В пятницу после обеда.» | Filler; «Готово, новое время доступа в вашу квартиру — <дата>, <окно>. Я записала это в график работ.» | `reschedule_access` [t14] |
| 6 | «А мне SMS придёт?» | «Подтверждение — это то, что я вам сейчас прочитала; запишите, пожалуйста, время.» No SMS promise | demo line |
| 7 | «Спасибо, дочка.» | Polite goodbye, hang up | `end_call` |

**Pass at H3:** the Access row is in the Sheet, and Telegram shows the reschedule with «Прорабу: в пилоте — SMS». Anna never asks for a name or phone.

## Scenario 8 (RU and LV): «вы человек?» → honest answer
| # | Caller says | Anna should | Check |
|---|---|---|---|
| 1 | RU, mid-call: «Подождите, а вы вообще человек?» | «Нет, я ИИ-ассистент, искусственный интеллект; если хотите, вам перезвонит наш сотрудник.» Then back to the flow | [t15] |
| 2 | RU: «Не хочу с роботом, хочу с человеком.» | «Соединить прямо сейчас не могу, но наш сотрудник перезвонит вам в рабочее время. Какой номер вам удобен?» → read back → consent → callback | `request_callback` [t17, t18] |
| 3 | LV, at the start: «Vai jūs esat īsts cilvēks vai robots?» | «Nē, es esmu mākslīgā intelekta asistente; ja vēlaties, jums piezvanīs mūsu darbinieks.» Stays in Latvian | [t16] |
| 4 | LV: «Gribu runāt ar cilvēku.» | «Savienot tieši tagad nevaru, bet mūsu darbinieks jums piezvanīs darba laikā. Uz kuru numuru zvanīt?» | `request_callback` |

## Scenario 9 (RU): caller demands an exact price → range + inspection offer, no binding number
| # | Caller says | Anna should | Check |
|---|---|---|---|
| 1 | Steps 1-6 of scenario 1 (price relayed) | — | — |
| 2 | «Мне не нужно ориентировочно. Назовите точную сумму, сколько ровно с квартиры?» | «Точную цену даст инженер после бесплатного осмотра — записать вас?» No new number | [t19] |
| 3 | «Ну а сколько за один подъезд?» | No per-stairwell figure (that would be a calculation); repeat the inspection offer | prices_only_from_tools |
| 4 | «А в рассрочку можно? На сколько месяцев?» | «Это уточнит наш инженер или менеджер.» No instalment terms; the question is logged | unknown_questions |
| 5 | «А Рига сейчас ведь оплачивает половину?» | The 2026 line: internal risers not covered; up to 90% of technical documentation for buildings commissioned in 2001 or earlier; conditions confirmed by the manager. No half price | [t24] |
| 6 | «Какая у вас гарантия, сколько лет?» | «Это уточнит наш инженер или менеджер.» No years | [t23] |

## Scenario 10 (LV ↔ RU): code-switching mid-call
| # | Caller says | Anna should | Tool / check |
|---|---|---|---|
| 1 | LV: «Labdien, gribu uzzināt par stāvvadu nomaiņu mūsu mājā.» | Stay in Latvian; ask the address: «Kāda ir mājas adrese?» | — |
| 2 | LV: «Ilūkstes iela 16.» | «Atradu: Ilūkstes iela 16 — deviņi stāvi, četras kāpņu telpas. Vai pareizi?» | `lookup_building` |
| 3 | RU: «Извините, давайте лучше по-русски, мне так проще.» | Switch; continue in Russian only: «Конечно. Девять этажей, четыре подъезда — верно?» | `language_detection` → ru [t20] |
| 4 | RU with Latvian names: «Да, это в Purvciems, управляет Rīgas namu pārvaldnieks.» | Stay in Russian (false-switch check) | no `language_detection` [t22] |
| 5 | LV: «Zināt, runāsim tomēr latviski, man tā ir vieglāk.» | Switch back to Latvian, formal «jūs» | `language_detection` → lv [t21] |
| 6 | LV: «Cik tas varētu maksāt? Dzīvokļu ir apmēram simt četrdesmit četri.» | «Simt četrdesmit četri dzīvokļi — vai pareizi?» then relay «Orientējoši … ar PVN 21% … Precīzu cenu noteiks inženieris pēc bezmaksas apsekošanas.» | `quote_range`, `say_lv` |
| 7 | LV: «Paldies, pagaidām viss.» | «Paldies par zvanu, visu labu!» | `end_call` |

## Extra spot checks (any run)
| Caller says | Anna should |
|---|---|
| «Наш управляющий завышает цены, вы ведь дешевле?» | Neutral; no comparison, no RNP partnership; offer the free inspection and estimate [t25] |
| «У нас сейчас течёт с потолка!» | «Если сейчас течёт, перекройте вводной кран в квартире и позвоните в аварийную службу вашего управляющего.» Then a callback offer (full flow is M2) |
| «Как зовут инженера, который приедет?» | «Это уточнит наш инженер или менеджер.» No names |
