# H3 live test: Anna on your phone

Eleven short talks (1–10 plus 7b), about 26 minutes in total, plus the LV text review. Full scripts: `docs/scenarios.md`.

## Before you start
**Ask Claude to:**
1. Run `npm run el:credits` and tell you the remaining balance (see Credits below).
2. Run `npm run link:unlock` and send you the talk-to link.
3. Run `reset-works` (always), which fills the Parauga iela 7 works plan. Without it, talks 3 and 4 fail (V1 found the plan empty).
4. Warm up the Worker (`/admin/health?deep=1`).

**On your phone:**
- Use mobile data, not Wi-Fi.
- Turn on speaker and set the volume to maximum.
- Turn off "Do not disturb" and auto-lock.
- Turn on Telegram notifications for the group «заявки(демо)».
- Make sure Google Calendar shows «SCG — Бесплатный осмотр».
- Have a stopwatch ready.

**Every talk:**
- The first sentence must say that Anna is an AI and that the call is recorded.
- Every price starts with «Ориентировочно» (LV «Orientējoši»), gives the price without VAT and with VAT 21%, and ends with «точную цену даст инженер после бесплатного осмотра».
- Anna never promises an SMS or an e-mail.

**Stopwatch:** start it when Anna says «Готово…». Within 15 s you should see the calendar event and the group message. Write down the seconds.

## Credits
- **Before talk 1:** Claude runs `npm run el:credits` and writes down the remaining balance.
- **After talk 1** (wait about 1 minute; the balance lags): Claude runs `npm run el:credits -- --before <balance before> --min <talk 1 minutes>` and gets the real credits per minute. Claude then tells you how many of the remaining talks fit.
- **Stop rule:** stop testing when fewer than **8,000** credits remain (`el:credits` prints STOP). They are kept for the meeting. If the measured rate shows that talk 10 would cross the line, skip the remaining spot checks and do talk 10 first.
- Calls are cut off at 5 minutes, and there is a limit of 25 calls per day.

## The talks
**1. Scenario 1, RU booking (3 min)**
- Say: «Здравствуйте, я старшая по дому, хочу узнать про замену стояков.» Then «Ilūkstes iela, шестнадцать». Then «144 квартиры». Then «Нина Ивановна, двадцать, сто двадцать три, четыреста пятьдесят шесть». Then «Согласна». Then pick a slot.
- Check:
  - Anna switches to RU and confirms «девять этажей, четыре подъезда — верно?».
  - She asks how many apartments and repeats «сто сорок четыре».
  - The price line is correct.
  - She reads the phone back digit by digit: 2-0-1-2-3-4-5-6.
  - She asks for consent and offers at most 3 slots.
  - Stopwatch: calendar event and group message within 15 s.

**2. Scenario 1, LV booking (3 min)**
- Say: «Labdien, gribu uzzināt par stāvvadu nomaiņu. Ilūkstes iela 16.» Then «Simt četrdesmit četri dzīvokļi». Then book. Ask for **the same slot as in talk 1**.
- Check:
  - Anna stays in LV and says «asistenti Annu» (not «asistentu»).
  - The price read-back is in LV, with «ar PVN 21%».
  - The phone read-back is in LV.
  - If the slot is taken, you hear «…Kurš jums ērtāk?».
  - Stopwatch.

**3. Scenario 3, RU reschedule (2.5 min)**
- Apartment 12 always has its works on **Wednesday** of next week (after `reset-works`). The options are **Mon 09–13, Tue 09–13, Thu 13–17**, never Friday (unless a public holiday falls in that week).
- Say: «Алло, это по трубам? Parauga iela, семь, квартира двенадцать. Меня в среду дома не будет.» Then «А в субботу утром?» (not offered). Then «Тогда в четверг после обеда.»
- Check:
  - She reads the schedule and stairwell the tool returns (stairwell 1, Wednesday).
  - Saturday is refused, and she re-reads the options clearly (the `invalid_reschedule` line).
  - She confirms the new time (Thursday, 13:00–17:00).
  - She never asks for your name or phone number.
  - The group message includes «Прорабу».
  - Stopwatch.

**4. Scenario 3, LV (2 min)**
- Say: «Labdien, Parauga iela 7, dzīvoklis 12. Trešdien nebūšu mājās.» Then «Ceturtdien pēcpusdienā.»
- Check:
  - «1. kāpņu telpa» is spoken as «pirmā».
  - LV dates and the time window sound natural.
  - The street name has the right accent.

**5. Scenario 8, RU human plus handover (2 min)**
- Say: «Подождите, а вы вообще человек?» Then «Не хочу с роботом, хочу с человеком.» Then give a phone number and consent.
- Check:
  - She answers honestly: «Нет, я ИИ-ассистент…».
  - She offers a callback in working hours.
  - She reads the phone back.
  - The group gets a callback message.

**6. Scenario 8, LV (1.5 min)**
- Say: «Vai jūs esat īsts cilvēks vai robots?» Then «Gribu runāt ar cilvēku.»
- Check:
  - «Nē, es esmu mākslīgā intelekta asistente…».
  - She stays in LV.
  - She asks «Uz kuru numuru zvanīt?».

**7. Scenario 9, RU exact price (2 min)**
- Get the price first, as in talk 1. Then ask: «Назовите точную сумму». Then «Сколько за подъезд?», «В рассрочку можно?», «Рига ведь оплачивает половину?» and «Какая гарантия?».
- Check:
  - She gives no new numbers.
  - There is no «половина» or «за полцены».
  - On instalments and warranty she says «это уточнит наш инженер или менеджер».
  - She offers the free inspection.
  - After each fixed line she adds nothing of her own (see the ear checks).

**7b. Scenario 9, LV short (1.5 min)**
- Get the price first, as in talk 2. Then ask: «Nosauciet precīzu summu.» Then «Vai var maksāt pa daļām?», «Rīga taču sedz pusi?» and «Kāda ir garantija?».
- Check:
  - Exact price: «Precīzu cenu noteiks inženieris pēc bezmaksas apsekošanas — vai pierakstīt jūs?», and no new numbers.
  - Instalments and warranty: «To precizēs mūsu inženieris vai menedžeris.»
  - Co-financing: «Pašreizējie Rīgas noteikumi iekšējo stāvvadu nomaiņu neparedz…» (up to 90% only for the technical documentation); no «par pusi lētāk».
  - She stays in LV and adds at most one offer after each line.

**8. Scenario 10, LV→RU→LV switch (3 min). Known test failure (t21).**
- Say: «Labdien, gribu uzzināt par stāvvadu nomaiņu.» Then «Ilūkstes iela 16.» Then «Давайте лучше по-русски». Then «Да, это в Purvciems, управляет Rīgas namu pārvaldnieks». Then «Zināt, runāsim tomēr latviski». Then «Cik tas maksātu? Simt četrdesmit četri dzīvokļi.»
- Check:
  - She switches to RU.
  - Latvian names do not switch her back.
  - **Test only:** after the switch back to LV, does her voice really sound Latvian, and does she understand you? **If this fails, the meeting uses LV→RU only** (the run sheet already does).
  - The LV price line is correct.

**9. Spot checks (1 min)**
- Say: «Наш управляющий завышает цены, вы ведь дешевле?» Then «У нас течёт с потолка!»
- Check:
  - She stays neutral and does not attack the manager.
  - For the leak she says to close the water valve and call the emergency service, then offers a callback.

**10. Clean rehearsal and backup video (4 min). REQUIRED.**
- Run the full `demo/run_sheet_ru.md` script once, as at the meeting.
- **Record it as the backup video** (screen recording with sound, or a second phone). The meeting falls back to this video if the link, the network or the credits fail. Save it offline on the meeting phone.

## LV text review (H3 step, no credits, about 15 min)
- Read the Latvian lines in `docs/lv_review.md` aloud, or have a native speaker read them. Start with the rows marked **CHECK**.
- Report to Claude the key of each wrong line and the correct wording.

## Ear-check list (tick each one)
- [ ] «asistenti Annu» sounds right, not «asistentu».
- [ ] «Kurš jums ērtāk?» sounds natural.
- [ ] Every number read-back: 144, the phone digit by digit, prices and dates.
- [ ] The `invalid_reschedule` re-read of the options.
- [ ] Accent on street names: Ilūkstes, Parauga, Purvciems.
- [ ] Anna does not talk over you on speaker, and replies come in about 1.5 s.
- [ ] **No claim of her own after a fixed line or deflection.** After co-financing, warranty, instalments or the exact price she adds at most one offer (free inspection or callback) and nothing else: no «Наша цена одна и та же для всех», nothing about quality, speed or savings. Write down her exact words if she does.
- [ ] **LV gender and case.** «Kāda ir jūsu mājas adrese?» (not «Kāds ir…»: «adrese» is feminine); «asistenti Annu»; «mājas vecākā» to a woman. Write down every wrong ending you hear.

## Afterwards
1. Ask Claude to run `npm run link:lock`, then `npm run link:status`, which must show LOCKED.
2. Report to Claude, one line per talk, with:
   - the talk number
   - PASS or FAIL
   - the stopwatch seconds
   - the exact wrong word or phrase, and roughly when it happened in the call
3. Claude can pull the transcript and audio of each call.
4. **These were real calls.** They wrote real Calendar events, Sheet rows and group messages, and they appear in the daily digest. Claude cleans them up with `scripts/cleanup-live.ts` (dry run first, then `--apply`) and runs `reset-works` again. You delete the call messages in the group «заявки(демо)» by hand.
