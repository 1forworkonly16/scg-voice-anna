export const PHRASES = {
  price_range: {
    ru: "Ориентировочно для вашего дома — от {low_net} до {high_net} евро без НДС, или от {low_gross} до {high_gross} с НДС двадцать один процент — это примерно {per_apt_gross} евро на квартиру с НДС. Точную цену даст инженер после бесплатного осмотра.",
    lv: "Orientējoši jūsu mājai — no {low_net} līdz {high_net} eiro bez PVN, tas ir no {low_gross} līdz {high_gross} eiro ar PVN 21%, aptuveni {per_apt_gross} eiro uz vienu dzīvokli ar PVN. Precīzu cenu noteiks inženieris pēc bezmaksas apsekošanas.",
  },
  building_found: {
    ru: "Нашла: {address} — {facts}, верно?",
    lv: "Atradu: {address} — {facts}, vai pareizi?",
  },
  building_confirm: {
    ru: "Правильно ли я поняла: {address}?",
    lv: "Vai pareizi sapratu — {address}?",
  },
  building_need_house: {
    ru: "{street} — а какой номер дома?",
    lv: "{street} — kāds ir mājas numurs?",
  },
  building_not_found: {
    ru: "Этот адрес я в справочнике не нашла, но это не страшно. Сколько в доме этажей, подъездов и примерно сколько квартир?",
    lv: "Šo adresi sarakstā neatradu, bet tas nekas. Cik mājā ir stāvu, kāpņu telpu un aptuveni cik dzīvokļu?",
  },
  slots_offer: {
    ru: "Для бесплатного осмотра свободно: {slot1}; {slot2}; или {slot3}. Какое время вам удобнее?",
    lv: "Bezmaksas apsekošanai brīvie laiki: {slot1}, {slot2} vai {slot3}. Kurš laiks jums der?",
  },
  no_slots: {
    ru: "Сейчас в календаре нет свободного времени для осмотра. Хотите, мы перезвоним вам в рабочее время и согласуем день?",
    lv: "Šobrīd kalendārā apsekošanai brīva laika nav. Vai vēlaties, lai mēs jums piezvanām darba laikā un vienojamies par dienu?",
  },
  booking_ok: {
    ru: "Готово, я записала вас на бесплатный осмотр: {address}, {slot}. Пожалуйста, запишите это время — это и есть ваше подтверждение.",
    lv: "Esmu jūs pierakstījusi bezmaksas apsekošanai: {address}, {slot}. Lūdzu, pierakstiet šo laiku — tas ir jūsu apstiprinājums.",
  },
  slot_taken: {
    ru: "К сожалению, это время только что заняли; свободно ещё: {alt1} или {alt2}. Что вам удобнее?",
    lv: "Diemžēl šis laiks tikko kļuva aizņemts; vēl ir pieejami: {alt1} vai {alt2}. Kurš jums ērtāk?",
  },
  invalid_phone: {
    ru: "Кажется, я неправильно записала номер. Продиктуйте его, пожалуйста, ещё раз.",
    lv: "Šķiet, numuru pierakstīju nepareizi. Lūdzu, nosauciet to vēlreiz.",
  },
  calendar_down: {
    ru: "Календарь сейчас не отвечает, поэтому время осмотра я подтвердить не могу. Хотите, мы перезвоним вам в рабочее время и согласуем день?",
    lv: "Kalendārs šobrīd neatbild, tāpēc apsekošanas laiku apstiprināt nevaru. Vai vēlaties, lai mēs jums piezvanām darba laikā un vienojamies par dienu?",
  },
  works_found: {
    ru: "Квартира {apartment}, {stairwell} подъезд: работы у вас по графику — {date}, {window}. Хотите перенести это время?",
    lv: "Dzīvoklis {apartment}, {stairwell}. kāpņu telpa: darbi pēc grafika paredzēti — {date}, {window}. Vai vēlaties šo laiku pārcelt?",
  },
  works_not_found: {
    ru: "По этому адресу и квартире я не нашла график работ. Хотите, мы перезвоним вам в рабочее время?",
    lv: "Šai adresei un dzīvoklim darbu grafiku neatradu. Vai vēlaties, lai mēs jums piezvanām darba laikā?",
  },
  access_rescheduled: {
    ru: "Готово, новое время доступа в вашу квартиру — {date}, {window}. Я записала это в график работ.",
    lv: "Labi, jaunais piekļuves laiks jūsu dzīvoklim — {date}, {window}. Esmu to ierakstījusi darbu grafikā.",
  },
  callback_ok: {
    ru: "Хорошо, я передала вашу просьбу — вам перезвонят в рабочее время, с понедельника по пятницу, с девяти утра до пяти вечера.",
    lv: "Labi, jūsu lūgumu esmu nodevusi — jums piezvanīs darba laikā, no pirmdienas līdz piektdienai no 9 līdz 17.",
  },
  tool_error_generic: {
    ru: "Извините, у меня техническая заминка. Хотите, мы перезвоним вам в рабочее время?",
    lv: "Atvainojiet, radās tehniska kļūme. Vai vēlaties, lai mēs jums piezvanām darba laikā?",
  },
  unknown_question: {
    ru: "Это уточнит наш инженер или менеджер — я записала ваш вопрос.",
    lv: "To precizēs mūsu inženieris vai menedžeris — jūsu jautājumu esmu pierakstījusi.",
  },
  invalid_reschedule: {
    ru: "К сожалению, на это время перенести нельзя. Сейчас я ещё раз назову свободные варианты.",
    lv: "Diemžēl uz šo laiku pārcelt nevar. Tūlīt vēlreiz nosaukšu pieejamos variantus.",
  },
  slots_offer_two: {
    ru: "Для бесплатного осмотра свободно: {slot1} или {slot2}. Какое время вам удобнее?",
    lv: "Bezmaksas apsekošanai brīvie laiki: {slot1} vai {slot2}. Kurš laiks jums der?",
  },
  slots_offer_one: {
    ru: "Для бесплатного осмотра сейчас свободно только одно время: {slot1}. Вам подходит?",
    lv: "Bezmaksas apsekošanai šobrīd brīvs tikai viens laiks: {slot1}. Vai jums der?",
  },
} as const;
