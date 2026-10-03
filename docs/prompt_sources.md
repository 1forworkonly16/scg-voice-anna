# Sources for every factual claim in the prompt and phrases

Paths are relative to `../info/` unless they start with `docs/`. Line numbers as of 2026-10-03. The prompt itself carries no ids, to stay short.

| # | Claim (where used) | Source file:line | Id |
|---|---|---|---|
| 1 | SCG works since 2008 (prompt §1) | data/company.json L24 | [S20][S21] (company.json legal src) |
| 2 | Replaces water, sewer and heating risers and basement pipes in apartment buildings (prompt §1) | data/services.json L6-8, L16 | [S04][S12][S16] |
| 3 | Free inspection and estimate («бесплатный осмотр и смета» / «bezmaksas apsekošana un tāme») (prompt §1, §6; phrases) | data/services.json L22-30; copy/site_text_lv.md L791; data/glossary_lv_ru_en.json L17-18 | [S05][S17] |
| 4 | Engineer looks at the systems in the basement and apartments (prompt §6) | 02_how_the_business_works.md L45 | [S05] |
| 5 | Office hours Mon–Fri 9:00–17:00 (prompt §6; callback_ok) | data/company.json L59; copy/ru_key_messages.md L58 | [S17] |
| 6 | Office phones +371 22848144, +371 29327275 (prompt §6) | data/company.json L57, L68 | [S17] |
| 7 | Risers are common property; owners decide at a general meeting or written poll; 50%+1 signatures (prompt §6) | copy/ru_key_messages.md L51; data/services.json L42 | [S06] |
| 8 | Three-party contract: owners' representative + manager + chosen company; paid from the repair savings fund (prompt §6) | copy/ru_key_messages.md L52; data/services.json L41, L47 | [S06][S11][S12] |
| 9 | About 1.5 months from decision to start of works, in SCG's experience (prompt §6) | copy/ru_key_messages.md L53; data/services.json L46 | [S06][S11][S12] |
| 10 | Residents give access, clear the shaft, cover belongings; water/sewer off, dust and noise (prompt §6) | copy/ru_key_messages.md L54; 02 L92; data/services.json L13 | [S04] |
| 11 | Single-apartment replacement possible, slab sections leak later (prompt §6) | copy/ru_key_messages.md L55; 02 L90 | [S16] |
| 12 | Co-financing 2026: internal risers not covered by Riga's rules (prompt §6; t24) | 04_market_and_regulation.md L29; copy/ru_key_messages.md L56 | [S32][S33] |
| 13 | Up to 90% of technical documentation (inspection, energy certificate, technical project), buildings commissioned in 2001 or earlier; «условия уточнит наш менеджер» because L56 is marked to verify | 04 L30 («≤2001»); copy/ru_key_messages.md L56; docs/plan.md L36 | [S34][S35] |
| 14 | Leak now: close the inlet valve, call the manager's emergency service (prompt §4E) | copy/ru_key_messages.md L75; 02 L61 | — (SCG copy) |
| 15 | Role question wording; manager question naming Rīgas namu pārvaldnieks as an option (prompt §4A) | copy/ru_key_messages.md L65, L69 | — (SCG copy) |
| 16 | AI disclosure + recording notice in sentence 1 (first_message, presets) | demo-briefs/C_ai_phone_assistant.md L64, L103; 02 L69-70; docs/plan.md L38 | [S54] |
| 17 | Price speech: «Ориентировочно», net + «с НДС 21%», per apartment, ends «точную цену даст инженер после бесплатного осмотра» (price_range) | docs/plan.md L165-168; copy/ru_key_messages.md L41, L45, L76 | [A25] (price model), [A21] |
| 18 | Never speak instalments or working-day estimates | docs/plan.md L32; root CLAUDE.md rule 3 | — |
| 19 | Banned phrases and RNP rule (prompt §7; evaluation criterion) | copy/ru_key_messages.md L91-93; docs/plan.md L37 | — |
| 20 | Do not criticise managers; no legal advice; no third-party data; never pretend to be human | demo-briefs/C L66-67, L105; root CLAUDE.md rule 4 | — |
| 21 | Unknowns (warranty, instalments, engineer names, lead time, …) → «это уточнит наш инженер/менеджер» + logged | docs/plan.md L39 | — |
| 22 | Handover = callback in working hours; no live transfer in demo mode (prompt §4C; callback_ok) | copy/ru_key_messages.md L58; demo-briefs/C L36, L68 | — |
| 23 | No SMS/e-mail in the demo; the read-back is the confirmation; consultant says «в пилоте придёт SMS» (prompt §8; booking_ok) | docs/plan.md L21 | — |
| 24 | Ilūkstes iela 16: 9 floors, 4 stairwells sourced (scenarios, tests) | copy/site_text_lv.md L318-320; docs/plan.md L33 | [S13][S14] (company.json L94) |
| 25 | Ilūkstes iela 16: 144 apartments is an assumption, so Anna never states it | docs/plan.md L33; 07_assumptions.md L30 (36 apts per 9-floor stairwell × 4) | [A17] |
| 26 | Parauga iela 7 is a fictional ДЕМО building for the works flow | docs/plan.md L40 | — |
| 27 | Terms: стояки/stāvvadi, лежаки/guļvadi, старший по дому/mājas vecākais, kāpņu telpa, apsaimniekotājs, avārijas dienests, būvdarbu vadītājs | data/glossary_lv_ru_en.json L4-5, L22, L24, L38-39, L45 | — |
| 28 | Scenario list 1, 3, 8, 9, 10 | demo-briefs/C L111-121 | — |

**Deliberately left out of the prompt** (sourced, but risky in a call): the «7 days» estimate turnaround (services.json L29; a timeline promise), the 20–40% three-party savings (services.json L45; reads as a manager comparison), manufacturers' 40–60-year pipe life (services.json L17; easily heard as a warranty), past client names (company.json L91-97). No dynamic variables are used: `system__time_utc` exists (plan L56), but giving it to the model invites date arithmetic; `get_slots` supplies today and the labels.
