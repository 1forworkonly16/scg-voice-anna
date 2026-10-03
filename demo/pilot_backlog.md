# Pilot backlog (demo C → 30-day pilot)

Items that are out of scope for the demo (brief C §0 item 3, §12 "pilot only") plus the open WP6 advisories. Costs: see `../info/08_offers_and_costs.md` §0b (column "Live"); none are restated here.

## Telephony
| # | Item | What to do | Done when |
|---|---|---|---|
| P1 | **+371 number in SCG's name** | Order with SCG's company documents (Telnyx preferred, native ElevenLabs integration; DIDWW / didlogic or a Latvian operator SIP line as alternatives; not GHL LC Phone, brief C §0 item 4). Import into ElevenLabs, assign to Anna. | A call to the number reaches Anna; the number is on SCG's account |
| P2 | **Conditional forwarding** | SCG forwards its existing mobiles on no answer (~20 s) / busy / out of hours (brief C §6). No porting. | Forwarding tested from each SCG line, after hours and overflow |
| P3 | **SMS confirmations** | Add `send_sms` (Telnyx) after `book_inspection` and `reschedule_access`, in the caller's language. Only then may Anna's lines mention SMS; update the prompt, copy lint (SMS-promise rule) and tests together. | SMS arrives in RU and LV; copy lint updated |
| P4 | **Transfer to a human** | `transfer_call` to the office line in working hours and to the on-call technician for leaks at SCG sites; 60 s no answer → SMS to on-call + Dima (brief C §7). Today Anna books a callback instead. | «хочу с человеком» transfers in office hours; leak escalation tested |

## Data protection
| # | Item | What to do |
|---|---|---|
| P5 | **EU data region / DPA** | Creator processes in the US (plan risk 10). Check which ElevenLabs plan offers EU data residency and what it costs; sign DPAs with ElevenLabs, Google, Cloudflare and the telephony provider; accounts in SCG's name with the consultant as admin (08 §0b "Who pays"). Telegram has no DPA: keep personal data in Telegram messages to the minimum. |
| P6 | **Retention** | Recordings and transcripts 90 days (set on the agent). Define and automate retention for the Sheet rows (Leads, Calls, Callbacks, Access), the Calendar events and the Telegram group history; write it into SCG's privacy notice. |
| P7 | **Privacy notice + consent** | SCG's privacy-policy URL for the widget `terms_text` and the call opening; RU + complete LV. |

## Scheduling rule
| # | Item | What to do |
|---|---|---|
| P8 | **Holiday weekend shift** | Latvian law moves the day off to the next working day when 4 May, 18 November or the song-festival day off falls on a weekend. The holiday table was checked online for the demo window (WP6), but the code note on this rule is worded wrongly. Before the pilot: fix the note and re-check the table online for every year in the booking horizon (WP2 status). |

## Open WP6 advisories (Worker)
| # | Advisory | Effect | Suggested fix |
|---|---|---|---|
| A1 | A revived cancelled booking is reported as «перенос» | Telegram and the Sheet call a re-booking of a cancelled event a reschedule | Distinguish "re-booked after cancel" from "moved" by the event's previous status |
| A2 | Moving a booking does not update its Leads row | The Sheet shows the old slot after a reschedule | Update the Leads row (slot, status) in the same request as the Calendar move |
| A3 | Telegram 4000-character cut can drop the footer | A very long summary loses the footer with the reference id | Truncate the body first and always append the footer |
| A4 | `GET /tools` returns 405 | Harmless, but inconsistent with 404 for unknown routes | Decide on one behaviour and test it |
| A5 | A phone number under 6 characters returns `invalid_input` | Anna gets the generic error instead of the `invalid_phone` recovery line | Validate phone length in the handler and return `invalid_phone` |

Also before the pilot (from earlier reports): the cold-isolate CPU (9-14 ms on Workers Free) disappears on Workers Paid (08 §0b); the double-booking race needs a re-check after insert (plan risk 9).
