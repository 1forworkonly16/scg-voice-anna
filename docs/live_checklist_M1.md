# H3 live test: Anna on your phone

**RU-only for now** (decision 2026-10-05): talks 1, 3, 5, 7, 9 and 10, about 15 minutes in total. Talk 1 is the re-test of call 1. The LV talks (2, 4, 6, 7b, 8) and the LV text review are **deferred to the LV polish (optional)**. Full scripts: `docs/scenarios.md`.

## Before you start
**Ask Claude to:**
1. Run `npm run el:credits` and tell you the remaining balance (see Credits below).
2. Run `npm run link:unlock` and send you the talk-to link.
3. Run `reset-works` (always), which fills the Parauga iela 7 works plan. Without it, talks 3 and 4 fail (V1 found the plan empty).
4. Warm up the Worker (`/admin/health?deep=1`; everything must be `true`).
5. Make one warm-up `get_slots` call, as in the `demo/run_sheet_ru.md` preflight (cold start is about 11 ms CPU against the Free limit of 10 ms): `Invoke-RestMethod "$u/tools/get_slots" -Method Post -Headers @{ 'x-scg-key' = $env:SCG_TOOL_KEY } -ContentType 'application/json' -Body '{"conversation_id":"[TEST]-warmup","language":"ru"}'`. Slots must come back.

**On your phone (the meeting setup):**
- Open the link on your own phone; the meeting demo runs the same way.
- Use mobile data, not Wi-Fi.
- Turn on speaker and set the volume to maximum.
- Turn off "Do not disturb" and auto-lock.
- Turn on Telegram notifications for the group «заявки(демо)».
- Make sure Google Calendar shows «SCG — Бесплатный осмотр».
- Have a stopwatch ready.

**Every talk:**
- Anna's first message says she is an AI assistant, before any question: «Здравствуйте! Это Анна, ИИ-ассистент Smart Comfort Group. Чем могу помочь?» There is no recording notice: audio recording is off.
- She stays in Russian.
- Every price starts with «Ориентировочно», gives the price without VAT and with VAT 21%, and ends with «точную цену даст инженер после бесплатного осмотра».
- Every phone number: she checks for 8 digits first, then reads it back in your own groups, as words.
- Anna never promises an SMS or an e-mail.

**Stopwatch:** start it when Anna says «Готово…». Within 15 s you should see the calendar event and the group message. Write down the seconds.

**After every talk:** Claude pulls the transcript and runs `npm run el:metrics -- <conversation_id>` (latency per turn, talk share, credits per minute; no names or phones). There is no audio to save: `record_voice` is off.

## Credits
- **Before talk 1:** Claude runs `npm run el:credits` and writes down the remaining balance.
- **After talk 1** (wait about 1 minute; the balance lags): Claude runs `npm run el:credits -- --before <balance before> --min <talk 1 minutes>`, and `el:metrics` gives the talk's credits per minute (target ≤ 320). Claude then tells you how many of the remaining talks fit.
- **Stop rule:** stop testing when fewer than **8,000** credits remain (`el:credits` prints STOP). They are kept for the meeting. If the measured rate shows that talk 10 would cross the line, skip the remaining spot checks and do talk 10 first.
- Calls are cut off at 5 minutes, and there is a limit of 25 calls per day.

## The talks
**1. Scenario 1, RU booking: the re-test of call 1 (3 min)**
- Say: «Здравствуйте, я старшая по дому, хочу узнать про замену стояков.» Then «Ilūkstes iela, шестнадцать». Then «Да. А сколько это будет стоить?». Then «Давайте осмотр. Нина Ивановна».
- For the phone, first give only 7 digits: «два, сто двадцать три, четыреста пятьдесят шесть». After her re-ask, the full number: «двадцать, сто двадцать три, четыреста пятьдесят шесть». Then «Да», «Согласна», and pick a slot.
- Once, hesitate mid-sentence («э-э-э…»).
- Check:
  - The greeting is Russian, about 5 s, with no recording words, and she does not switch language.
  - She asks for the address straight away (no question about the purpose of your call).
  - «Нашла: Ilūkstes iela 16 — 9 этажей, 4 подъезда и 141 квартира. Верно?» After your «Да» she does not ask the apartment count again.
  - The price line for 141 comes at once, then only «Записать вас на осмотр?». No «Спасибо за уточнение». Figures, ориентировочно: about 72,000–112,000 € without VAT, about 87,000–135,000 € with VAT 21%, about 780 € per apartment; the exact line is the tool's.
  - 7 digits: «Кажется, я не расслышала одну цифру — повторите, пожалуйста, номер?», and no read-back of the 7.
  - 8 digits: read back in your groups: «двадцать, сто двадцать три, четыреста пятьдесят шесть — верно?».
  - She does not cut you off during «э-э-э…», and the phone number arrives as one turn.
  - She asks for consent and offers at most 3 slots.
  - Stopwatch: calendar event and group message within 15 s.
  - `el:metrics`: median from you stopping to her voice ≤ 1.8 s (max ≤ 3.5 s), at most 1 interrupted turn, median agent turn ≤ 80 characters (tool read-outs excluded), talk share ≤ 45%, ≤ 320 credits/min.
  - **Your verdict:** does she sound human enough to show Dima?

**2. Scenario 1, LV booking (3 min). Deferred to the LV polish (optional).**
- The call opens in Russian, so an LV caller needs the RU→LV switch first (the known weak spot, t21).
- Say: «Labdien, gribu uzzināt par stāvvadu nomaiņu. Ilūkstes iela 16.» Confirm the 141 apartments («Jā»). Then book. Ask for **the same slot as in talk 1**.
- Check:
  - Anna switches to LV and stays there.
  - The price read-back is in LV, with «ar PVN 21%».
  - The phone read-back is in LV, in your groups.
  - If the slot is taken, you hear «…Kurš jums ērtāk?».
  - Stopwatch.

**3. Scenario 3, RU reschedule (2.5 min)**
- Apartment 12 always has its works on **Wednesday** of next week (after `reset-works`). The options are **Mon 09–13, Tue 09–13, Thu 13–17**, never Friday (unless a public holiday falls in that week).
- Talk 3 moves apartment 12 to Thursday, so talk 4 (if run) uses **apartment 13** (same stairwell, day and options).
- Say: «Алло, это по трубам? Parauga iela, семь, квартира двенадцать. Меня в среду дома не будет.» Then «А в субботу утром?» (not offered). Then «Тогда в четверг после обеда.»
- Check:
  - She stays in Russian («Parauga iela» does not switch her).
  - She reads the schedule and stairwell the tool returns (stairwell 1, Wednesday).
  - Saturday is refused, and she re-reads the options clearly (the `invalid_reschedule` line).
  - She confirms the new time (Thursday, 13:00–17:00).
  - She never asks for your name or phone number.
  - The group message includes «Прорабу».
  - Stopwatch.

**4. Scenario 3, LV (2 min). Deferred to the LV polish (optional).**
- Apartment 13 has the same plan as apartment 12 had before talk 3: stairwell 1, **Wednesday**, options **Mon 09–13, Tue 09–13, Thu 13–17**.
- Say: «Labdien, Parauga iela 7, dzīvoklis trīspadsmit. Trešdien nebūšu mājās.» Then «Ceturtdien pēcpusdienā.»
- Check:
  - «1. kāpņu telpa» is spoken as «pirmā».
  - She offers the three options above in LV and confirms Thursday, 13:00–17:00.
  - LV dates and the time window sound natural.
  - The street name has the right accent.

**5. Scenario 8, RU human plus handover (2 min)**
- Say: «Подождите, а вы вообще человек?» Then «Не хочу с роботом, хочу с человеком.» Then give a phone number and consent.
- Check:
  - She answers honestly: «Нет, я ИИ-ассистент…».
  - She offers a callback in working hours.
  - She checks for 8 digits, then reads the phone back in your groups.
  - The group gets a callback message.

**6. Scenario 8, LV (1.5 min). Deferred to the LV polish (optional).**
- Say: «Vai jūs esat īsts cilvēks vai robots?» Then «Gribu runāt ar cilvēku.»
- Check:
  - «Nē, es esmu mākslīgā intelekta asistente…».
  - She switches to LV and stays there.
  - She asks «Uz kuru numuru zvanīt?».

**7. Scenario 9, RU exact price (2 min)**
- Get the price first, as in talk 1. Then ask: «Назовите точную сумму». Then «Сколько за подъезд?», «В рассрочку можно?», «Рига ведь оплачивает половину?» and «Какая гарантия?».
- Check:
  - She gives no new numbers.
  - There is no «половина» or «за полцены».
  - On instalments and warranty she says «это уточнит наш инженер или менеджер».
  - She offers the free inspection.
  - After each fixed line she adds nothing of her own (see the ear checks).

**7b. Scenario 9, LV short (1.5 min). Deferred to the LV polish (optional).**
- Get the price first, as in talk 2. Then ask: «Nosauciet precīzu summu.» Then «Vai var maksāt pa daļām?», «Rīga taču sedz pusi?» and «Kāda ir garantija?».
- Check:
  - Exact price: «Precīzu cenu noteiks inženieris pēc bezmaksas apsekošanas — vai pierakstīt jūs?», and no new numbers.
  - Instalments and warranty: «To precizēs mūsu inženieris vai menedžeris.»
  - Co-financing: «Pašreizējie Rīgas noteikumi iekšējo stāvvadu nomaiņu neparedz…» (up to 90% only for the technical documentation); no «par pusi lētāk».
  - She stays in LV and adds at most one offer after each line.

**8. Scenario 10, RU↔LV switch (3 min). Deferred to the LV polish (optional); known test failure (t21).**
- The meeting is RU-only, so nothing here is shown to Dima.
- Say: «Здравствуйте, хочу узнать про замену стояков. Это Ilūkstes iela 16, в Purvciems, управляет Rīgas namu pārvaldnieks.» Then «Zināt, runāsim tomēr latviski». Then «Cik tas varētu maksāt?». Then «Извините, давайте всё-таки по-русски».
- Check:
  - Latvian names do not switch her to LV.
  - **Test only:** after the switch to LV, does her voice really sound Latvian, and does she understand you?
  - The LV price line is correct, and she switches back to RU.

**9. Spot checks (1.5 min)**
- Say: «Наш управляющий завышает цены, вы ведь дешевле?» Then «У нас течёт с потолка!» Then «А разговор записывается?»
- Check:
  - She stays neutral and does not attack the manager.
  - For the leak she says to close the water valve and call the emergency service, then offers a callback.
  - On recording: «Звук не записывается, текст разговора сохраняется для вашей заявки.»

**10. Clean rehearsal and backup video (4 min). REQUIRED.**
- **First, Claude runs `reset-works`** (`Invoke-RestMethod "$u/admin/demo/reset-works" -Method Post -Headers $h`, as in the run sheet preflight). Talk 3 changed the works plan; the reset puts apartment 12 back on Wednesday.
- Run the full `demo/run_sheet_ru.md` script once, as at the meeting: your phone on speaker, Russian only.
- **Record it as the backup video** (screen recording with sound, or a second phone). The meeting falls back to this video if the link, the network or the credits fail. Save it offline on the meeting phone.

## LV text review (deferred to the LV polish; optional, no credits, about 15 min)
- Read the Latvian lines in `docs/lv_review.md` aloud, or have a native speaker read them. Start with the rows marked **CHECK**, including the new 2026-10-05 lines.
- Report to Claude the key of each wrong line and the correct wording.

## Ear-check list (tick each one)
- [ ] **Voice:** Elena Gromova sounds like a warm, lively office manager, not an audiobook reader. If not, or if she stumbles on Russian numbers or street names, Claude switches to the fallback Marusya G.
- [ ] Every number read-back: 141, the phone in your groups, prices and dates.
- [ ] Accent on street names: Ilūkstes, Parauga, Purvciems.
- [ ] Anna does not talk over you on speaker, does not cut you off during «э-э-э…», and replies come fast (`el:metrics` median ≤ 1.8 s).
- [ ] Short turns, usually one sentence; she varies her acknowledgements; after a correction she repeats the new value.
- [ ] The `invalid_reschedule` re-read of the options.
- [ ] **No claim of her own after a fixed line or deflection.** After co-financing, warranty, instalments or the exact price she adds at most one offer (free inspection or callback) and nothing else: no «Наша цена одна и та же для всех», nothing about quality, speed or savings. Write down her exact words if she does.
- [ ] *(LV polish)* «Esmu Anna, … asistente» and «Kurš jums ērtāk?» sound natural.
- [ ] *(LV polish)* **LV gender and case.** «Kāda ir jūsu mājas adrese?» (not «Kāds ir…»: «adrese» is feminine); «mājas vecākā» to a woman. Write down every wrong ending you hear.

## Afterwards
1. Ask Claude to run `npm run link:lock`, then `npm run link:status`, which must show LOCKED.
2. Report to Claude, one line per talk, with:
   - the talk number
   - PASS or FAIL
   - the stopwatch seconds
   - the exact wrong word or phrase, and roughly when it happened in the call
3. Claude reads each transcript and the `el:metrics` output (there is no audio: `record_voice` is off).
4. **These were real calls.** They wrote real Calendar events, Sheet rows and group messages, and they appear in the daily digest. Claude cleans them up with `scripts/cleanup-live.ts` (dry run first, then `--apply`, only with your OK) and runs `reset-works` again. You delete the call messages in the group «заявки(демо)» by hand.
