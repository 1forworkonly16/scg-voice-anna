# H3 live test: Anna on your phone

Ten short talks, about 24 minutes in total. Full scripts: `docs/scenarios.md`.

## Before you start
**Ask Claude to:**
1. Run `npm run link:unlock` and send you the talk-to link.
2. Warm up the Worker (`/admin/health?deep=1`).
3. Run `reset-works`, which fills the Parauga iela 7 works plan. Without it, talks 3 and 4 fail (V1 found the plan empty).

**On your phone:**
- Use mobile data, not Wi-Fi.
- Turn on speaker and set the volume to maximum.
- Turn off "Do not disturb" and auto-lock.
- Turn on Telegram notifications for the group «SCG — Заявки (демо)».
- Make sure Google Calendar shows «SCG — Бесплатный осмотр».
- Have a stopwatch ready.

**Every talk:**
- The first sentence must say that Anna is an AI and that the call is recorded.
- Every price starts with «Ориентировочно» (LV «Orientējoši»), gives the price without VAT and with VAT 21%, and ends with «точную цену даст инженер после бесплатного осмотра».
- Anna never promises an SMS or an e-mail.

**Stopwatch:** start it when Anna says «Готово…». Within 15 s you should see the calendar event and the group message. Write down the seconds.

## Credits
- About **450 credits per minute** of talk. You have about **22,500**.
- The 10 talks below take about 24 minutes, which is about 11,000 credits. That leaves enough for the meeting (about 2,500 credits) and retries.
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
- Say: «Алло, это по трубам? Parauga iela, семь, квартира двенадцать. Меня в тот день дома не будет.» Then «А в субботу утром?» (not offered). Then pick one of the options she reads out.
- Check:
  - She reads the schedule and stairwell the tool returns (stairwell 1 is expected).
  - Saturday is refused, and she re-reads the options clearly (the `invalid_reschedule` line).
  - She confirms the new time.
  - She never asks for your name or phone number.
  - The group message includes «Прорабу».
  - Stopwatch.

**4. Scenario 3, LV (2 min)**
- Say: «Labdien, Parauga iela 7, dzīvoklis 12. Ceturtdien nebūšu mājās.»
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

**8. Scenario 10, LV→RU→LV switch (3 min). Known test failure (t21).**
- Say: «Labdien, gribu uzzināt par stāvvadu nomaiņu.» Then «Ilūkstes iela 16.» Then «Давайте лучше по-русски». Then «Да, это в Purvciems, управляет Rīgas namu pārvaldnieks». Then «Zināt, runāsim tomēr latviski». Then «Cik tas maksātu? Simt četrdesmit četri dzīvokļi.»
- Check:
  - She switches to RU.
  - Latvian names do not switch her back.
  - **After the switch back to LV, does her voice really sound Latvian, and does she understand you?**
  - The LV price line is correct.

**9. Spot checks (1 min)**
- Say: «Наш управляющий завышает цены, вы ведь дешевле?» Then «У нас течёт с потолка!»
- Check:
  - She stays neutral and does not attack the manager.
  - For the leak she says to close the water valve and call the emergency service, then offers a callback.

**10. Clean rehearsal (4 min)**
- Run the full `demo/run_sheet_ru.md` script once, as at the meeting.
- Optional: record it as the backup video.

## Ear-check list (tick each one)
- [ ] «asistenti Annu» sounds right, not «asistentu».
- [ ] «Kurš jums ērtāk?» sounds natural.
- [ ] Every number read-back: 144, the phone digit by digit, prices and dates.
- [ ] The `invalid_reschedule` re-read of the options.
- [ ] Accent on street names: Ilūkstes, Parauga, Purvciems.
- [ ] Anna does not talk over you on speaker, and replies come in about 1.5 s.

## Afterwards
1. Ask Claude to run `npm run link:lock`, then `npm run link:status`, which must show LOCKED.
2. Report to Claude, one line per talk, with:
   - the talk number
   - PASS or FAIL
   - the stopwatch seconds
   - the exact wrong word or phrase, and roughly when it happened in the call
3. Claude can pull the transcript and audio of each call.
4. **These were real calls.** They wrote real Calendar events, Sheet rows and group messages, and they appear in the daily digest. Ask Claude to clean them up and to run `reset-works` again before the meeting.
