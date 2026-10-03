// M2 phrase templates (create_ticket, log_request). Same shape and rules as phrases.ts, kept in its own file so the M1 copy
// table and its contract with PHRASE_SPEC stay untouched. Placeholder sets are fixed in PHRASE_SPEC_M2 (checked by a unit test).
// Facts: leak advice «перекройте вводной кран» and «аварийная служба вашего управляющего» are from info/copy/ru_key_messages.md §6
// and info/02 §6; no live transfer, no SMS and no callback time are promised (demo mode, no +371 number yet).
export const PHRASES_M2 = {
  ticket_ok: {
    ru: "Я записала вашу заявку и передала её нашему менеджеру. Если хотите, чтобы вам перезвонили, назовите номер телефона.",
    lv: "Esmu pierakstījusi jūsu pieteikumu un nodevusi to mūsu menedžerim. Ja vēlaties, lai jums piezvana, nosauciet tālruņa numuru.",
  },
  ticket_urgent: {
    ru: "Это срочная заявка, я сразу передала её нашему менеджеру. Если сейчас течёт — перекройте вводной кран в квартире. Назовите, пожалуйста, номер телефона, чтобы с вами можно было связаться.",
    lv: "Šis ir steidzams pieteikums, es to uzreiz nodevu mūsu menedžerim. Ja šobrīd tek ūdens, lūdzu, aizgrieziet ūdens ievada krānu dzīvoklī. Lūdzu, nosauciet tālruņa numuru, lai ar jums varētu sazināties.",
  },
  ticket_urgent_other: {
    ru: "Я записала срочную заявку и передала её менеджеру. Если сейчас течёт — перекройте вводной кран в квартире и позвоните в аварийную службу вашего управляющего. Назовите номер телефона, если хотите, чтобы мы перезвонили.",
    lv: "Esmu pierakstījusi steidzamu pieteikumu un nodevusi to menedžerim. Ja šobrīd tek ūdens, aizgrieziet ūdens ievada krānu dzīvoklī un zvaniet sava apsaimniekotāja avārijas dienestam. Nosauciet tālruņa numuru, ja vēlaties, lai mēs piezvanām.",
  },
  ticket_alert_failed: {
    ru: "Заявку я записала, но срочно передать её прямо сейчас не получилось. Если течёт — перекройте вводной кран в квартире и позвоните в аварийную службу вашего управляющего. Назовите номер телефона, и мы перезвоним в рабочее время.",
    lv: "Pieteikumu esmu pierakstījusi, bet steidzami nodot to tieši tagad neizdevās. Ja tek ūdens, aizgrieziet ūdens ievada krānu dzīvoklī un zvaniet sava apsaimniekotāja avārijas dienestam. Nosauciet tālruņa numuru, un mēs piezvanīsim darba laikā.",
  },
  request_ok: {
    ru: "Хорошо, я передала ваше сообщение нашим сотрудникам. Если хотите, чтобы вам перезвонили, назовите номер телефона.",
    lv: "Labi, esmu nodevusi jūsu ziņu mūsu darbiniekiem. Ja vēlaties, lai jums piezvana, nosauciet tālruņa numuru.",
  },
  request_emergency_referral: {
    ru: "Если сейчас течёт — перекройте вводной кран в квартире и позвоните в аварийную службу вашего управляющего. Я записала ваше обращение; мы можем приехать на осмотр позже — записать вас на бесплатный осмотр?",
    lv: "Ja šobrīd tek ūdens, aizgrieziet ūdens ievada krānu dzīvoklī un zvaniet sava apsaimniekotāja avārijas dienestam. Esmu pierakstījusi jūsu pieteikumu; varam ierasties apsekošanā vēlāk — vai pierakstīt jūs uz bezmaksas apsekošanu?",
  },
} as const;

export const PHRASE_SPEC_M2 = {
  ticket_ok: [],
  ticket_urgent: [],
  ticket_urgent_other: [],
  ticket_alert_failed: [],
  request_ok: [],
  request_emergency_referral: [],
} as const satisfies Record<keyof typeof PHRASES_M2, readonly string[]>;

export type PhraseKeyM2 = keyof typeof PHRASES_M2;
