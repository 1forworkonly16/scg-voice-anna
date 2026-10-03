# Latvian strings for review at H3

Every Latvian line Anna can say, written by WP3 (Opus). Please read them aloud or have a native speaker check them. **CHECK** = I am not fully sure of the wording or the case; the alternative is given. Terms follow `../info/data/glossary_lv_ru_en.json` (stāvvadi, guļvadi, bezmaksas apsekošana, kāpņu telpa, mājas vecākais, apsaimniekotājs, avārijas dienests, būvdarbu vadītājs).

Design rule: tool placeholders (`{address}`, `{slot}`, `{date}` …) arrive in the nominative or as ready-made labels, so the phrases put them after a colon or a dash, where no case ending is needed.

## Opening (`elevenlabs/prompt/first_message.md`, `presets.json` lv)
| Key | LV | RU meaning | Note |
|---|---|---|---|
| first_message | Labdien, Smart Comfort Group, jūs runājat ar mākslīgā intelekta asistenti Annu; saruna tiek ierakstīta. Kā varu palīdzēt? Можно по-русски. | Здравствуйте, Smart Comfort Group, вы говорите с ИИ-ассистентом Анной; разговор записывается. Чем могу помочь? | Feminine accusative after «ar»: «asistenti Annu». The greeting ends in a comma (not «!») so that sentence 1 holds the disclosure for any sentence splitter. CHECK: «Labdien, Smart Comfort Group, …» reads naturally on the phone? |

## System prompt (`elevenlabs/prompt/system_prompt.md`)
| Key | LV | RU meaning | Note |
|---|---|---|---|
| §1 are_you_human | Nē, es esmu mākslīgā intelekta asistente; ja vēlaties, jums piezvanīs mūsu darbinieks. | Нет, я ИИ-ассистент; если хотите, вам перезвонит наш сотрудник. | |
| §1 feminine example | esmu pierakstījusi | я записала | |
| §2 switch request example | Runāsim latviski | Давайте по-латышски | |
| §3 read-back | Deviņi stāvi, četras kāpņu telpas — vai pareizi? | Девять этажей, четыре подъезда — верно? | |
| §3 plain words | caurules pagrabā | трубы в подвале | used before «guļvadi» |
| §4 role | Kāda ir jūsu loma — mājas vecākais, biedrības valdes loceklis vai dzīvokļa īpašnieks? | Вы старший по дому, член правления или владелец квартиры? | CHECK: «loma» may sound formal; alternative «Vai jūs esat mājas vecākais, biedrības valdes loceklis vai dzīvokļa īpašnieks?» |
| §4 name | Kā varu jūs uzrunāt? | Как к вам обращаться? | |
| §4 consent | Vai piekrītat, ka saglabājam jūsu vārdu un tālruni šim pieteikumam? | Согласны, чтобы мы сохранили ваше имя и телефон для этой заявки? | CHECK: «tālruņa numuru» may be clearer than «tālruni» |
| §4 handover | Savienot tieši tagad nevaru, bet mūsu darbinieks jums piezvanīs darba laikā. Uz kuru numuru zvanīt? | Соединить сейчас не могу, но наш сотрудник перезвонит в рабочее время. Какой номер удобен? | |
| §4 unknown | To precizēs mūsu inženieris vai menedžeris. | Это уточнит наш инженер или менеджер. | CHECK: «menedžeris» is common in speech; a purist would say «vadītājs» or «speciālists» |
| §4 leak | Ja šobrīd tek, aizgrieziet ievada krānu dzīvoklī un zvaniet sava apsaimniekotāja avārijas dienestam. | Если сейчас течёт, перекройте вводной кран в квартире и позвоните в аварийную службу вашего управляющего. | CHECK: «ievada krāns» vs «galvenais krāns» (what residents actually say) |
| §5 filler 1 | Mirklīti, pārbaudu. | Секунду, проверяю. | |
| §5 filler 2 | Tūlīt paskatīšos. | Сейчас посмотрю. | |
| §5 filler 3 | Mirklīti, pierakstu. | Минутку, записываю. | |
| §5 "tomorrow" | rīt | завтра | only in the never-compute rule |
| §5 goodbye | Paldies par zvanu, visu labu! | Спасибо за звонок, всего доброго! | |
| §6 co-financing | Pašreizējie Rīgas noteikumi iekšējo stāvvadu nomaiņu neparedz. Taču Rīga sedz līdz 90% no tehniskās dokumentācijas izmaksām — apsekošanai, energosertifikātam, tehniskajam projektam — mājām, kas nodotas ekspluatācijā 2001. gadā vai agrāk; nosacījumus precizēs mūsu menedžeris. | Нынешние правила Риги не включают замену внутренних стояков. Но Рига компенсирует до 90% технической документации … для домов, сданных в эксплуатацию в 2001 году или раньше; условия уточнит наш менеджер. | CHECK: the dative list after the dash («apsekošanai, …») reads as "for the inspection, …"; alternative «… izmaksām: tehniskajai apsekošanai, energosertifikātam un tehniskajam projektam». Also check «nodotas ekspluatācijā» |
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
| booking_ok | Esmu pierakstījusi bezmaksas apsekošanu: {address}, {slot}. Lūdzu, pierakstiet šo laiku — tas ir jūsu apstiprinājums. | Готово, я записала бесплатный осмотр: … Пожалуйста, запишите это время — это и есть ваше подтверждение. | feminine «pierakstījusi» |
| slot_taken | Diemžēl šis laiks tikko kļuva aizņemts; vēl brīvi: {alt1} vai {alt2}. Kas jums ērtāk? | К сожалению, это время только что заняли; свободно ещё: … Что удобнее? | CHECK: «vēl brīvi:» (plural, laiki implied) |
| invalid_phone | Šķiet, numuru pierakstīju nepareizi. Lūdzu, nosauciet to vēlreiz pa vienam ciparam. | Кажется, я неправильно записала номер. Продиктуйте ещё раз по цифрам. | |
| calendar_down | Kalendārs šobrīd neatbild, tāpēc apsekošanas laiku apstiprināt nevaru. Vai vēlaties, lai mēs jums piezvanām darba laikā un vienojamies par dienu? | Календарь не отвечает, подтвердить время не могу. Хотите, мы перезвоним? | |
| works_found | Dzīvoklis {apartment}, kāpņu telpa numur {stairwell}: darbi pēc grafika paredzēti — {date}, {window}. Vai vēlaties šo laiku pārcelt? | Квартира …, подъезд …: работы по графику — … Хотите перенести это время? | CHECK: «numur» is the spoken form; written standard is «Nr.» (TTS may read it as letters). Alternative: «{stairwell}. kāpņu telpa» if code passes an ordinal |
| works_not_found | Pēc šīs adreses un dzīvokļa numura darbu grafiku neatradu. Vai vēlaties, lai mēs jums piezvanām darba laikā? | По этому адресу и квартире график не нашла. Хотите, мы перезвоним? | |
| access_rescheduled | Labi, jaunais piekļuves laiks jūsu dzīvoklim — {date}, {window}. Esmu to ierakstījusi darbu grafikā. | Готово, новое время доступа — … Я записала это в график работ. | CHECK: «piekļuves laiks» is understandable but bureaucratic; alternative «jaunais laiks, kad darbinieki ienāks jūsu dzīvoklī» |
| callback_ok | Labi, jūsu lūgumu esmu nodevusi — jums piezvanīs darba laikā, no pirmdienas līdz piektdienai no 9 līdz 17. | Хорошо, я передала вашу просьбу — вам перезвонят в рабочее время, пн–пт с 9 до 17. | |
| tool_error_generic | Atvainojiet, radās tehniska kļūme. Vai vēlaties, lai mēs jums piezvanām darba laikā? | Извините, техническая заминка. Хотите, мы перезвоним? | |
| unknown_question | To precizēs mūsu inženieris vai menedžeris — jūsu jautājumu esmu pierakstījusi. | Это уточнит наш инженер или менеджер — я записала ваш вопрос. | see «menedžeris» above |

## Prompt addendum and tool description (`presets.json`, `tool_descriptions.json`)
English instructions only; the Latvian examples there («Runāsim latviski», «labi», «paldies») are reused from above.

## Test fixtures and scenario caller lines (not spoken by Anna; review optional)
| Where | LV | Note |
|---|---|---|
| test mocks (slot labels) | ceturtdien 8. oktobrī plkst. 10.00 | proposed label style for WP2 |
| scenarios.md S10 | Labdien, gribu uzzināt par stāvvadu nomaiņu mūsu mājā. / Zināt, runāsim tomēr latviski, man tā ir vieglāk. / Cik tas varētu maksāt? Dzīvokļu ir apmēram simt četrdesmit četri. / Paldies, pagaidām viss. | caller lines |
| scenarios.md S8 | Vai jūs esat īsts cilvēks vai robots? / Gribu runāt ar cilvēku. | caller lines |
| t20 history | Labprāt palīdzēšu. Kāda ir mājas adrese? | Anna line in test history |
