# Latvian strings for review at H3

Every Latvian line Anna can say, written by WP3 (Opus). Please read them aloud or have a native speaker check them. **CHECK** = I am not fully sure of the wording or the case; the alternative is given. Terms follow `../info/data/glossary_lv_ru_en.json` (stāvvadi, guļvadi, bezmaksas apsekošana, kāpņu telpa, mājas vecākais, apsaimniekotājs, avārijas dienests, būvdarbu vadītājs).

Design rule: tool placeholders (`{address}`, `{slot}`, `{date}` …) arrive in the nominative or as ready-made labels, so the phrases put them after a colon or a dash, where no case ending is needed.

## New lines 2026-10-06 (H3 re-test, rework round 2): all CHECK
Dima does not hear these lines either (RU-only meeting). Where: greeting and max-duration in `presets.json` / `agent_config.json`, soft timeout in `agent_config.json`, the rest in `elevenlabs/prompt/system_prompt.md` (§2, §3, §5, §6; mirrored in `prompt_m2`). Rule behind the punctuation: no «!» in any of Anna's lines, because it makes the voice jump (`docs/decisions.md` 2026-10-06, «Tone»).

| Key | LV | RU meaning | Note |
|---|---|---|---|
| greeting (lv preset) | Labdien. Esmu Anna, Smart Comfort Group mākslīgā intelekta asistente. Kā varu palīdzēt? | Здравствуйте. Это Анна, ИИ-ассистент Smart Comfort Group. Чем могу помочь? | CHECK: «Labdien.» with a period sounds natural as a phone opening? Wording as on 2026-10-05 |
| max-duration message | Sarunas laiks ir beidzies. Paldies par zvanu, visu labu. | Время разговора закончилось. Спасибо за звонок, всего доброго. | CHECK: period instead of «!» |
| soft timeout (LLM slow, after 4 s) | Mirklīti. | Секундочку. | CHECK; was «Mirklīti, lūdzu.» |
| §2 bare greeting / line check | Jā, klausos. | Да, слушаю вас. | CHECK: alternative «Jā, es klausos.» |
| §3 silence check-in (once) | Hallo, vai jūs mani dzirdat? | Алло, вы меня слышите? | CHECK: «Hallo» or «Halo» on the phone |
| §3 acknowledgements | Labi. / Sapratu. | Хорошо. / Поняла. / Так. / Ага. | CHECK; «Lieliski.» and «Protams.» dropped (no praise) |
| §3 caller backchannel = yes | mhm / jā-jā | угу / ага / да-да | caller words, listed so Anna treats them as agreement |
| §5 filler `lookup_building` | Mirklīti, skatos. | Секунду, смотрю. | CHECK |
| §5 filler `quote_range` | Mirklīti, skatos cenu. | Секундочку, смотрю цену. | CHECK |
| §5 filler `get_slots` | Mirklīti, skatos brīvos laikus. | Секундочку, смотрю свободное время. | CHECK: «brīvos laikus» (accusative plural) |
| §5 filler `book_inspection` (M2 also `create_ticket`) | Mirklīti, pierakstu. | Минутку, записываю. | CHECK |
| §5 filler `find_works_schedule` | Mirklīti, skatos grafiku. | Секунду, смотрю график. | CHECK |
| §5 filler `reschedule_access` | Mirklīti, pārceļu. | Минутку, переношу. | CHECK |
| §5 filler `request_callback` (M2 also `log_request`) | Mirklīti, nododu. | Минутку, передаю. | CHECK: «nododu» alone may sound unfinished; alternative «Mirklīti, nododu ziņu.» |
| §5 goodbye | Paldies par zvanu. Visu labu. | Спасибо за звонок. Всего доброго. | CHECK: period instead of «!» |
| §6 office hours, spoken form | no pirmdienas līdz piektdienai, no deviņiem līdz septiņpadsmitiem | с понедельника по пятницу, с девяти утра до пяти вечера | CHECK: declined «septiņpadsmitiem» or indeclinable «līdz septiņpadsmit»; alternative mirroring the RU: «no deviņiem rītā līdz pieciem vakarā» |

## New lines 2026-10-05 (H3 call-1 feedback): all CHECK
The meeting demo is Russian-only and the LV polish comes after Dima agrees (`docs/decisions.md`, 2026-10-05), so Dima does not hear these lines. Where: the LV greeting is the `lv` preset (`presets.json`); the other lines are in `elevenlabs/prompt/system_prompt.md`.

| Key | LV | RU meaning | Note |
|---|---|---|---|
| greeting (lv preset) | Labdien! Esmu Anna, Smart Comfort Group mākslīgā intelekta asistente. Kā varu palīdzēt? | Здравствуйте! Это Анна, ИИ-ассистент Smart Comfort Group. Чем могу помочь? | **Punctuation superseded 2026-10-06** («Labdien.», table above). CHECK. Nominative «asistente», so there is no accusative ending to mishear (the spike heard «asistentu» 27 of 27 times). No recording notice: audio recording is off. Alternative: «Labdien! Esmu Anna, uzņēmuma Smart Comfort Group mākslīgā intelekta asistente. Kā varu palīdzēt?» |
| asked about recording | Skaņa netiek ierakstīta; sarunas teksts tiek saglabāts jūsu pieteikumam. | Звук не записывается, текст разговора сохраняется для вашей заявки. | CHECK the dative «jūsu pieteikumam»; alternative «… tiek saglabāts jūsu pieteikuma vajadzībām.» Said only when asked |
| phone: a digit missing | Šķiet, nesadzirdēju vienu ciparu — lūdzu, atkārtojiet numuru? | Кажется, я не расслышала одну цифру — повторите, пожалуйста, номер? | CHECK: an imperative ending in «?» mirrors the RU; alternative «Šķiet, vienu ciparu nesadzirdēju. Vai varat, lūdzu, atkārtot numuru?» |
| after the price | Vai pierakstīt jūs uz apsekošanu? | Записать вас на осмотр? | CHECK «uz apsekošanu» against the dative in booking_ok («pierakstījusi bezmaksas apsekošanai»); pick one form for both. Alternative «Vai pierakstīt jūs apsekošanai?» |
| acknowledgements | Labi. / Sapratu. / Lieliski. / Protams. | Хорошо. / Поняла. / Отлично. / Конечно. | **Superseded 2026-10-06** (table above: no praise). CHECK: natural on the phone? «Lieliski» may sound too eager if repeated. «Sapratu» has no gender, so it fits Anna |
| asked who is speaking | Jā, šī ir Smart Comfort Group, es esmu Anna — mākslīgā intelekta asistente. Kā varu palīdzēt? | Да, это Smart Comfort Group, я Анна — ИИ-ассистент. Чем могу помочь? | CHECK: «šī ir» for a company on the phone (alternative «Jā, jūs esat sazvanījuši Smart Comfort Group …»); nominative «asistente» as in the greeting |

## Opening (`elevenlabs/prompt/first_message.md`, `presets.json` lv)
| Key | LV | RU meaning | Note |
|---|---|---|---|
| first_message | Labdien, Smart Comfort Group, jūs runājat ar mākslīgā intelekta asistenti Annu; saruna tiek ierakstīta. Kā varu palīdzēt? Можно по-русски. | Здравствуйте, Smart Comfort Group, вы говорите с ИИ-ассистентом Анной; разговор записывается. Чем могу помочь? | **Superseded 2026-10-05** by the new greeting above (no recording notice, no «Можно по-русски», nominative «asistente»); kept for the record. Feminine accusative after «ar»: «asistenti Annu». The greeting ends in a comma (not «!») so that sentence 1 holds the disclosure for any sentence splitter. CHECK: «Labdien, Smart Comfort Group, …» reads naturally on the phone? EAR CHECK at H3: the text is correct (feminine accusative after «ar»), but speech-to-text heard the masculine «asistentu» in 27 of 27 spike samples; listen whether Marina says «asistenti». If it still sounds masculine, use the nominative, where the ending is clearer: «… Smart Comfort Group, es esmu mākslīgā intelekta asistente Anna; saruna tiek ierakstīta.» |

## System prompt (`elevenlabs/prompt/system_prompt.md`)
| Key | LV | RU meaning | Note |
|---|---|---|---|
| §1 are_you_human | Nē, es esmu mākslīgā intelekta asistente; ja vēlaties, jums piezvanīs mūsu darbinieks. | Нет, я ИИ-ассистент; если хотите, вам перезвонит наш сотрудник. | |
| §1 feminine example | esmu pierakstījusi | я записала | |
| §1 asked what the name and phone are for (new 2026-10-06) | Vārdu un tālruni izmantojam tikai šim pieteikumam. | Имя и телефон мы используем только для этой заявки. | CHECK |
| §1 greeting talked over: start of the first reply (new 2026-10-06, «Greeting interruptible»; prompt rule from WPV2) | Esmu Anna, mākslīgā intelekta asistente. | Это Анна, ИИ-ассистент. | CHECK |
| §2 switch request example | Runāsim latviski | Давайте по-латышски | |
| §3 read-back | Deviņi stāvi, četras kāpņu telpas — vai pareizi? | Девять этажей, четыре подъезда — верно? | |
| §3 plain words | caurules pagrabā | трубы в подвале | used before «guļvadi» |
| §4 role | Kāda ir jūsu loma — mājas vecākais, biedrības valdes loceklis vai dzīvokļa īpašnieks? To a woman who speaks of herself in the feminine: «mājas vecākā», «valdes locekle», «dzīvokļa īpašniece». | Вы старший по дому, член правления или владелец квартиры? (женщине: «старшая по дому») | CHECK: «loma» may sound formal; alternative «Vai jūs esat mājas vecākais, biedrības valdes loceklis vai dzīvokļa īpašnieks?» |
| §4 name | Kā varu jūs uzrunāt? | Как к вам обращаться? | |
| §4 consent | Vai piekrītat, ka saglabāsim jūsu vārdu un tālruņa numuru šim pieteikumam? | Согласны, чтобы мы сохранили ваше имя и телефон для этой заявки? | **Removed 2026-10-06** (no consent question, `docs/decisions.md`); replaced by «§4 phone» below |
| §4 phone (new 2026-10-06; booking and any callback) | Un jūsu tālruņa numurs — saziņai par šo pieteikumu? | И ваш телефон — для связи по этой заявке? | CHECK: a question without a verb; alternative «Un kāds ir jūsu tālruņa numurs saziņai par šo pieteikumu?» |
| §4 handover | Savienot tieši tagad nevaru, bet mūsu darbinieks jums piezvanīs darba laikā. Un jūsu tālruņa numurs — saziņai par šo pieteikumu? | Соединить прямо сейчас не могу, но наш сотрудник перезвонит вам в рабочее время. И ваш телефон — для связи по этой заявке? | CHECK: new phone question 2026-10-06 (was «Uz kuru numuru zvanīt?»); see «§4 phone» |
| §4 unknown | To precizēs mūsu inženieris vai menedžeris. | Это уточнит наш инженер или менеджер. | CHECK: «menedžeris» is common in speech; a purist would say «vadītājs» or «speciālists» |
| §4 leak | Ja šobrīd tek, aizgrieziet ievada krānu dzīvoklī un zvaniet sava apsaimniekotāja avārijas dienestam. | Если сейчас течёт, перекройте вводной кран в квартире и позвоните в аварийную службу вашего управляющего. | CHECK: «ievada krāns» vs «galvenais krāns» (what residents actually say) |
| §5 filler 1 | Mirklīti, pārbaudu. | Секунду, проверяю. | **Superseded 2026-10-06** by the fixed fillers (top table) |
| §5 filler 2 | Tūlīt paskatīšos. | Сейчас посмотрю. | **Superseded 2026-10-06** by the fixed fillers (top table) |
| §5 filler 3 | Mirklīti, pierakstu. | Минутку, записываю. | kept as the `book_inspection` filler (top table) |
| §5 "tomorrow" | rīt | завтра | only in the never-compute rule |
| §5 goodbye | Paldies par zvanu, visu labu! | Спасибо за звонок, всего доброго! | **Superseded 2026-10-06**: «Paldies par zvanu. Visu labu.» (top table) |
| §6 co-financing | Pašreizējie Rīgas noteikumi iekšējo stāvvadu nomaiņu neparedz. Taču mājām, kas nodotas ekspluatācijā 2001. gadā vai agrāk, Rīga sedz līdz 90% no tehniskās dokumentācijas — apsekošanas, energosertifikāta, tehniskā projekta — izmaksām; nosacījumus precizēs mūsu menedžeris. | Нынешние правила Риги не включают замену внутренних стояков. Но Рига компенсирует до 90% технической документации … для домов, сданных в эксплуатацию в 2001 году или раньше; условия уточнит наш менеджер. | List now in the genitive, inside «dokumentācijas … izmaksām». CHECK «nodotas ekspluatācijā» |
| §6 exact price | Precīzu cenu noteiks inženieris pēc bezmaksas apsekošanas — vai pierakstīt jūs? | Точную цену даст инженер после бесплатного осмотра — записать вас? | |
| §7 banned 1 | par pusi lētāk | за полцены | banned, listed so Anna avoids it |
| §7 banned 2 | divreiz ietaupīt | вдвойне сэкономить | banned |
| §7 banned 3 | garantēti lētāk nekā apsaimniekotājs | гарантированно дешевле управляющего | banned |
| §7 banned 4 | apsaimniekotājs uzpūš cenas | управляющий завышает цены | banned. CHECK: also «apsaimniekotājs paaugstina cenas» |
| §7 price word | orientējoši | ориентировочно | |
| §8 is it a demo | Jā, šī ir SCG asistentes demonstrācijas versija. | Да, это демонстрационная версия ассистента SCG. | |
| §8 SMS question | Apstiprinājums ir tas, ko es jums tikko nolasīju; lūdzu, pierakstiet laiku. | Подтверждение — это то, что я вам сейчас прочитала; запишите время. | |

## Tool phrases (`src/copy/phrases.ts`, `lv`)
| Key | LV | RU meaning | Note |
|---|---|---|---|
| price_range | Orientējoši jūsu mājai — no {low_net} līdz {high_net} eiro bez PVN, tas ir no {low_gross} līdz {high_gross} eiro ar PVN 21%, aptuveni {per_apt_gross} eiro uz vienu dzīvokli ar PVN. Precīzu cenu noteiks inženieris pēc bezmaksas apsekošanas. | Ориентировочно … без НДС … с НДС 21%, примерно … на квартиру. Точную цену даст инженер после бесплатного осмотра. | «no X līdz Y» needs genitive if numbers are spelled out in words (WP2 number speller): «no astoņdesmit tūkstošiem»? CHECK with the spike: numerals vs words |
| building_found | Atradu: {address} — {facts}. Vai pareizi? | Нашла: … Верно? | {facts} e.g. «deviņi stāvi, četras kāpņu telpas» (nominative) |
| building_confirm | Vai pareizi sapratu — {address}? | Правильно ли я поняла: …? | |
| building_need_house | {street} — kāds ir mājas numurs? | … — а какой номер дома? | |
| building_not_found | Šo adresi sarakstā neatradu, bet tas nekas. Cik mājā ir stāvu, kāpņu telpu un aptuveni cik dzīvokļu? | Этот адрес я не нашла, но это не страшно. Сколько этажей, подъездов и примерно квартир? | CHECK: «tas nekas» (never mind) is colloquial; alternative «tas nav šķērslis» |
| slots_offer | Bezmaksas apsekošanai brīvie laiki: {slot1}, {slot2} vai {slot3}. Kurš laiks jums der? | Для бесплатного осмотра свободно: … Какое время удобнее? | Recommended label format for WP2: «ceturtdien, 8. oktobrī, plkst. 10.00» (adverb + locative works after a colon) |
| no_slots | Šobrīd kalendārā apsekošanai brīva laika nav. Vai vēlaties, lai mēs jums piezvanām darba laikā un vienojamies par dienu? | Сейчас нет свободного времени. Хотите, мы перезвоним и согласуем день? | |
| booking_ok | Esmu jūs pierakstījusi bezmaksas apsekošanai: {address}, {slot}. Lūdzu, pierakstiet šo laiku — tas ir jūsu apstiprinājums. | Готово, я записала вас на бесплатный осмотр: … Пожалуйста, запишите это время — это и есть ваше подтверждение. | feminine «pierakstījusi» |
| slot_taken | Diemžēl šis laiks tikko kļuva aizņemts; vēl ir pieejami: {alt1} vai {alt2}. Kurš jums ērtāk? | К сожалению, это время только что заняли; свободно ещё: … Что удобнее? | |
| invalid_phone | Šķiet, numuru pierakstīju nepareizi. Lūdzu, nosauciet to vēlreiz pa vienam ciparam. | Кажется, я неправильно записала номер. Продиктуйте ещё раз по цифрам. | |
| calendar_down | Kalendārs šobrīd neatbild, tāpēc apsekošanas laiku apstiprināt nevaru. Vai vēlaties, lai mēs jums piezvanām darba laikā un vienojamies par dienu? | Календарь не отвечает, подтвердить время не могу. Хотите, мы перезвоним? | |
| works_found | Dzīvoklis {apartment}, {stairwell}. kāpņu telpa: darbi pēc grafika paredzēti — {date}, {window}. Vai vēlaties šo laiku pārcelt? | Квартира …, подъезд …: работы по графику — … Хотите перенести это время? | Code passes the stairwell as a digit, so «2. kāpņu telpa» must be read as the ordinal «otrā»: EAR CHECK at H3 (WP8 number normalisation must keep digit + dot here) |
| works_not_found | Šai adresei un dzīvoklim darbu grafiku neatradu. Vai vēlaties, lai mēs jums piezvanām darba laikā? | По этому адресу и квартире график не нашла. Хотите, мы перезвоним? | |
| access_rescheduled | Labi, jaunais piekļuves laiks jūsu dzīvoklim — {date}, {window}. Esmu to ierakstījusi darbu grafikā. | Готово, новое время доступа — … Я записала это в график работ. | CHECK: «piekļuves laiks» is understandable but bureaucratic; alternative «jaunais laiks, kad darbinieki ienāks jūsu dzīvoklī» |
| callback_ok | Labi, jūsu lūgumu esmu nodevusi — jums piezvanīs darba laikā, no pirmdienas līdz piektdienai no 9 līdz 17. | Хорошо, я передала вашу просьбу — вам перезвонят в рабочее время, пн–пт с 9 до 17. | |
| tool_error_generic | Atvainojiet, radās tehniska kļūme. Vai vēlaties, lai mēs jums piezvanām darba laikā? | Извините, техническая заминка. Хотите, мы перезвоним? | |
| unknown_question | To precizēs mūsu inženieris vai menedžeris — jūsu jautājumu esmu pierakstījusi. | Это уточнит наш инженер или менеджер — я записала ваш вопрос. | see «menedžeris» above |
| consent_required | Man vajadzīga jūsu piekrišana: saglabāsim jūsu vārdu un tālruņa numuru tikai šim pieteikumam, lai varētu ar jums par to sazināties. Vai piekrītat? | Мне нужно ваше согласие: мы сохраним ваше имя и номер телефона только для этой заявки, чтобы связаться с вами по ней. Вы согласны? | **Removed 2026-10-06** (no consent question; the phrase is gone from `src/copy/phrases.ts`). Was used by book_inspection and request_callback; said what is stored and why, no callback time |
| invalid_reschedule | Diemžēl uz šo laiku pārcelt nevar. Tūlīt vēlreiz nosaukšu pieejamos variantus. | К сожалению, на это время перенести нельзя. Сейчас я ещё раз назову свободные варианты. | the hint tells Anna to read the options again |
| slots_offer_two | Bezmaksas apsekošanai brīvie laiki: {slot1} vai {slot2}. Kurš laiks jums der? | Для бесплатного осмотра свободно: … или … Какое время вам удобнее? | same pattern as slots_offer |
| slots_offer_one | Bezmaksas apsekošanai šobrīd brīvs tikai viens laiks: {slot1}. Vai jums der? | Для бесплатного осмотра сейчас свободно только одно время: … Вам подходит? | |

## Prompt addendum and tool description (`presets.json`, `tool_descriptions.json`)
English instructions only; the Latvian examples there («Runāsim latviski», «labi», «paldies») are reused from above.

## Test fixtures and scenario caller lines (not spoken by Anna; review optional)
| Where | LV | Note |
|---|---|---|
| test mocks (slot labels) | ceturtdien 8. oktobrī plkst. 10.00 | proposed label style for WP2 |
| scenarios.md S10 | Labdien, gribu uzzināt par stāvvadu nomaiņu mūsu mājā. / Zināt, runāsim tomēr latviski, man tā ir vieglāk. / Cik tas varētu maksāt? Dzīvokļu ir apmēram simt četrdesmit četri. / Paldies, pagaidām viss. | caller lines |
| scenarios.md S8 | Vai jūs esat īsts cilvēks vai robots? / Gribu runāt ar cilvēku. | caller lines |
| t20 history | Labprāt palīdzēšu. Kāda ir mājas adrese? | Anna line in test history |

## Voice
2026-10-06: Anna ET (Kodukliima, `eleven_v3_conversational`) replaces Elena Gromova (`docs/decisions.md`). CHECK in the LV polish: how she sounds in Latvian, since it was chosen from the Estonian/Russian Kodukliima demo.

2026-10-05: Elena Gromova replaces Marina (`docs/decisions.md`). CHECK in the LV polish: how her Latvian sounds, since she was chosen for Russian. The note below is from WP3.

One voice (Marina) speaks both languages. Checked: no line in `system_prompt.md`, `first_message.md`, `presets.json` or `tool_descriptions.json` hands the caller to another speaker or colleague on a language switch; both presets introduce the same Anna. Nothing changed.

## WP3 polish changes, 2026-10-03 (verifier fixes + moved phrases)
| # | Where | Before | After |
|---|---|---|---|
| 1 | prompt §6 co-financing | … sedz līdz 90% no tehniskās dokumentācijas izmaksām — apsekošanai, energosertifikātam, tehniskajam projektam — mājām, kas nodotas ekspluatācijā 2001. gadā vai agrāk; … | Taču mājām, kas nodotas ekspluatācijā 2001. gadā vai agrāk, Rīga sedz līdz 90% no tehniskās dokumentācijas — apsekošanas, energosertifikāta, tehniskā projekta — izmaksām; … |
| 2 | phrases works_not_found | Pēc šīs adreses un dzīvokļa numura darbu grafiku neatradu. | Šai adresei un dzīvoklim darbu grafiku neatradu. |
| 3 | phrases slot_taken | … vēl brīvi: {alt1} vai {alt2}. Kas jums ērtāk? | … vēl ir pieejami: {alt1} vai {alt2}. Kurš jums ērtāk? |
| 4 | phrases works_found | Dzīvoklis {apartment}, kāpņu telpa numur {stairwell}: … | Dzīvoklis {apartment}, {stairwell}. kāpņu telpa: … |
| 5 | prompt §4 consent (**removed 2026-10-06**) | Vai piekrītat, ka saglabājam jūsu vārdu un tālruni šim pieteikumam? | Vai piekrītat, ka saglabāsim jūsu vārdu un tālruņa numuru šim pieteikumam? |
| 6 | prompt §4 role | masculine forms only | + "If the caller speaks of herself in the feminine…": LV «mājas vecākā», «valdes locekle», «dzīvokļa īpašniece»; RU «старшая по дому» |
| 7 | phrases booking_ok | Esmu pierakstījusi bezmaksas apsekošanu: … (RU Готово, я записала бесплатный осмотр: …) | Esmu jūs pierakstījusi bezmaksas apsekošanai: … (RU Готово, я записала вас на бесплатный осмотр: …) |
| 8 | phrases consent_required (moved from `src/routes/say.ts`; **removed 2026-10-06**) | Lai jūs pierakstītu, man vajadzīga jūsu piekrišana, ka «Smart Comfort Group» saglabā jūsu kontaktdatus un jums piezvana. Vai piekrītat? (RU … сохранит ваши контактные данные и перезвонит вам …) | Man vajadzīga jūsu piekrišana: saglabāsim jūsu vārdu un tālruņa numuru tikai šim pieteikumam, lai varētu ar jums par to sazināties. Vai piekrītat? (RU Мне нужно ваше согласие: мы сохраним ваше имя и номер телефона только для этой заявки, чтобы связаться с вами по ней. Вы согласны?) Names the data and the purpose, promises no callback, also fits request_callback. |
| 9 | phrases invalid_reschedule (moved) | Šis laiks pārcelšanai nav piemērots. Izvēlēsimies kādu no piedāvātajiem. (RU Это время для переноса не подходит. Давайте выберем одно из предложенных.) | Diemžēl uz šo laiku pārcelt nevar. Tūlīt vēlreiz nosaukšu pieejamos variantus. (RU К сожалению, на это время перенести нельзя. Сейчас я ещё раз назову свободные варианты.) |
| 10 | phrases slots_offer_two (moved) | Bezmaksas apsekošanai brīvie laiki: {slot1} vai {slot2}. Kurš laiks jums der? | unchanged |
| 11 | phrases slots_offer_one (moved) | Bezmaksas apsekošanai brīvs tikai viens laiks: {slot1}. Vai der? (RU … свободно только одно время: {slot1}. Подойдёт?) | Bezmaksas apsekošanai šobrīd brīvs tikai viens laiks: {slot1}. Vai jums der? (RU … сейчас свободно только одно время: {slot1}. Вам подходит?) |
| 12 | first message | jūs runājat ar mākslīgā intelekta asistenti Annu | unchanged: «ar» + feminine accusative «asistenti» is correct; ear check at H3 (see Opening) |
| 13 | `docs/prompt_sources.md` row 6 | company.json L57 | kept L57: re-checked, L57 = phones, L58 = e-mail; the verifier's L58 would be wrong |
