# Backup video: shot list (scenario 1, recorded at H3)

Purpose: if the network, the microphone or ElevenLabs fails at the meeting, play this instead (brief C §11 item 6). Target length 2:30-3:00. The voice and on-screen text are Russian, Anna's greeting included. The order follows `demo/run_sheet_ru.md`.

## Setup
- Phone screen recording with sound (built-in recorder, microphone on), 1080p, portrait. Phone on mobile data, as at the meeting.
- A second device films nothing; the caller is the consultant, speaking into the phone.
- **Keep out of frame:** the Google account e-mail in Calendar (open the event, not the account menu), other Telegram chats (open only the group «заявки(демо)»), notifications from other apps (Do Not Disturb with an exception for Telegram), the admin key or terminal windows.
- Fictional data only: «Нина Ивановна», «20 123 456», Ilūkstes iela 16 as in `docs/scenarios.md`.
- Unlock the link first (`npm run link:unlock`), lock it afterwards. The take costs about 3 voice minutes: log them in `docs/usage_log.md`.

## Shots
| # | Time | On screen | Audio / caption |
|---|---|---|---|
| 1 | 0:00 | Title card: «ИИ-ассистент Smart Comfort Group — демо. Данные выдуманные.» | silence |
| 2 | 0:05 | Talk-to page, tap to call | caption «19:30, офис закрыт» |
| 3 | 0:10 | Call screen | Anna's greeting, about 5 s: «Здравствуйте. Это Анна, ИИ-ассистент Smart Comfort Group. Чем могу помочь?» (no recording notice: audio recording is off). Caption «Первая фраза: Анна сразу говорит, что она ИИ» |
| 4 | 0:20 | Call screen | «Я старшая по дому, хочу узнать про замену стояков», then «Ilūkstes iela, шестнадцать». Anna: «Нашла: Ilūkstes iela 16 — 9 этажей, 4 подъезда и 141 квартира. Верно?» → «Да» |
| 5 | 0:40 | Call screen | The price line for 141 at once, with «ориентировочно», without and with VAT 21%, «точную цену даст инженер после бесплатного осмотра», then «Записать вас на осмотр?». When the video is shown, the consultant says the price-basis line live (run sheet, 1:05) |
| 6 | 1:10 | Call screen | «Назовите точную сумму» and the inspection offer instead |
| 7 | 1:25 | Call screen | «А вы вообще человек?» and the honest answer |
| 8 | 1:35 | Call screen | name, phone read back in the caller's groups, consent, up to 3 slots, booking confirmed |
| 9 | 2:20 | Google Calendar «SCG — Бесплатный осмотр», new event | caption with the stopwatch time from end of call to event |
| 10 | 2:30 | Telegram group «заявки(демо)», new message | caption «Заявка с данными дома — сразу у вас» |
| 11 | 2:45 | End card | «В пилоте — на ваш настоящий номер, когда никто не берёт трубку или после 17:00.» |

## After recording
- Watch it once in full: disclosure audible, price has «ориентировочно», no SMS promise, no wrong numbers.
- Save the MP4 offline on the phone and the laptop (not only in the cloud). Do not upload it anywhere public.
- Optional second take: scenario 3 (resident, «Parauga iela 7», about 0:45).
