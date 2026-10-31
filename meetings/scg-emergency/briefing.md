# Meeting with the SCG owner: "emergency help, pays 5000"

Your prep for the meeting. Read it once beforehand; in the room use the Russian card: [`questions_ru.md`](questions_ru.md).

## Goal of the meeting
1. Learn exactly what the 5000 buys and how that process runs today.
2. Leave with numbers and documents, not impressions.
3. Agree on one next step: your written proposal by a date you name.

You do **not** quote a price or a timeline in the room. That's not shyness: you can't price something you've only heard about for 45 minutes, and he'll respect a proposal that's built on his own numbers.

## What we know and what we don't

| Known (from what the repo already holds) | Not known (everything else) |
|---|---|
| Smart Comfort Group, Riga, working since 2008 | What the 5000 is for |
| Replaces water, sewer and heating risers and basement pipes in apartment buildings | Euros? Per month, per year, or once? |
| Works through three-party contracts: owners' representative + house manager + SCG; paid from the building's repair savings fund | Paid to whom: an outside firm, his own staff, software, damage repairs, a developer's quote? |
| Free inspection and estimate; an engineer checks the basement and apartments | What it covers and what costs extra |
| Office Mon–Fri 9:00–17:00 | Case volume, night/weekend share, buildings covered |
| Also subcontracts in Latvia, Sweden and Norway (plumbers, fitters, welders, ventilation, insulation crews) | Response-time obligations, and to whom |
| He watched the Anna demo and doesn't need a voice agent | People involved, their tools, his pain, his budget, his deadline, who decides |

Sources: `elevenlabs/prompt_m2/system_prompt.md` §6 and `docs/prompt_sources.md` (rows 1–10). Treat everything in the right-hand column as blank, even if you think you can guess it.

## Meeting flow (45–60 min)

| Time | What | You |
|---|---|---|
| 2 min | Thanks for the feedback on the demo, then «расскажите, с чем вы хотите разобраться» | One sentence, then stop talking |
| 25–30 min | He explains the 5000 and how the process runs today | Card sections 1–3. Ask for the **last real case, start to finish** |
| 10 min | Numbers, obligations, people, tools, pain | Card sections 4–8. Fill in the capture table |
| 5 min | Documents and next step | Card section 9 + the closing line |

Aim for him talking about 70% of the time.

## Listening rules
- **Last real case beats "usually".** «Расскажите последний случай» gives you times, people and tools. «Как обычно бывает» gives you opinions.
- **Write numbers, read every unit back to him.** «То есть 5000 евро в месяц, за все дома?» A misheard unit is a factor of 12.
- **Don't design the solution in the room.** When an idea comes up, write it in the margin and say «запишу, вернусь с предложением».
- **Silence is fine.** After a key question, wait. The second answer is usually the real one.
- **Ask "why" once or twice, not five times.** «А почему так сложилось?» is useful; an interrogation isn't.

## Capture table (fill in during the meeting and right after)

| Field | Answer |
|---|---|
| Amount and currency | |
| How often (month / year / once) | |
| Paid to (firm / own staff / software / repairs / other) | |
| What's included; what costs extra | |
| Since when; the contract and how to exit it | |
| What he doesn't like about it today | |
| Cases per month; night / weekend share; truly urgent share | |
| Buildings / apartments covered; seasonality | |
| Response-time obligations; to whom; what happens if late | |
| People involved; who is on duty; how duty is paid | |
| Where it's recorded today (Excel, software, WhatsApp, paper); accounting software | |
| What people have on their phones (Telegram, WhatsApp, Viber) | |
| Biggest pain (money or nerves) | |
| What "ideal" looks like; what must stay as is | |
| Success in 3 months, in his words | |
| Budget shape (one-off / monthly / no idea) | |
| Deadline | |
| Who else decides | |
| Documents he promised to send | |
| Questions you couldn't answer (to check) | |

## Don't say, don't promise
- **No price, no timeline** on the spot. Ready answers are on the card, section B.
- **No "AI handles emergencies".** Automation can move information and people faster; it doesn't replace the person who physically goes to a flooded basement.
- **No 24/7 support you can't staff.** If it's critical at night, the honest answer is a design where failure falls back to how it works today (see "Decide before you go").
- **Don't criticise** the current provider, his staff or the house managers, even if he does.
- **Don't pitch the voice agent again.** He said no; one feedback question is enough (card, question 10).
- **No invented references or clients.** You have one demo: show that.
- **No legal or liability answers** (who's responsible, what the law requires, GDPR details). Write them down: «уточню и отвечу письменно».

## Decide before you go (10 min, your own homework)
Have your own answers ready, even if you don't say them:
1. **Your floor price** for a first stage: below it, you'd say no.
2. **Paid pilot or not:** would you do a small, fixed-price first stage before a bigger commitment?
3. **Night support:** would you be on call for something critical? If not, what's your fallback design and your support hours?
4. **Partners:** would you bring in others (telephony, sensors, accounting integration), or stay software-only?
5. **Proposal date:** the date you can honestly promise the written proposal by. Pick something you'll beat.

## What you can show, if he asks what you've built
Say it as **capability**, not as his solution:
- **Live in the demo:** a Cloudflare Worker backend; a booking that lands in Google Calendar; every call logged to a Google Sheet; a Telegram message to the team within seconds; a daily digest in Telegram (`src/admin/digest.ts`).
- **Built and tested, not deployed:** urgent-leak tickets that escalate to Telegram as «СРОЧНО», with a keyword safety net (`src/lib/ticket.ts`, `src/notify/messages.ts`); the "is this an SCG building" check; logging non-client emergencies separately.
- **How it's built:** automated tests on every change; data stays in his own Google and Telegram accounts; only the data the task needs.

Have the demo Telegram group and the Sheet open on your phone in case he wants to see them.

## After the meeting
- **Same day:** a short thank-you plus a recap of what you understood, as 5–7 bullets in his numbers, ending «если я что-то понял неправильно — поправьте». It catches misunderstandings before you write the proposal.
- **By the promised date:** a one- or two-page proposal:
  1. the problem, in his numbers;
  2. stage 1 scope (small, testable);
  3. price and timeline;
  4. what stays exactly as it is today;
  5. what happens if the system fails (the fallback);
  6. what he saves or gains, and how you'll measure it.
- Check every open question from the capture table before you write it.
