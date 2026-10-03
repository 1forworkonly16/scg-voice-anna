// Phrases the contract needs but PHRASES (src/copy/phrases.ts, WP3) does not define yet.
// TODO(WP3): move these into src/copy/phrases.ts + PHRASE_SPEC and delete this file. Same style: formal «вы», no promises of SMS/e-mail, no prices.
export const EXTRA_PHRASES = {
  consent_required: {
    ru: "Чтобы записать вас, мне нужно ваше согласие на то, что «Смарт Комфорт Груп» сохранит ваши контактные данные и перезвонит вам. Вы согласны?",
    lv: "Lai jūs pierakstītu, man vajadzīga jūsu piekrišana, ka «Smart Comfort Group» saglabā jūsu kontaktdatus un jums piezvana. Vai piekrītat?",
  },
  invalid_reschedule: {
    ru: "Это время для переноса не подходит. Давайте выберем одно из предложенных.",
    lv: "Šis laiks pārcelšanai nav piemērots. Izvēlēsimies kādu no piedāvātajiem.",
  },
  slots_offer_two: {
    ru: "Для бесплатного осмотра свободно: {slot1} или {slot2}. Какое время вам удобнее?",
    lv: "Bezmaksas apsekošanai brīvie laiki: {slot1} vai {slot2}. Kurš laiks jums der?",
  },
  slots_offer_one: {
    ru: "Для бесплатного осмотра свободно только одно время: {slot1}. Подойдёт?",
    lv: "Bezmaksas apsekošanai brīvs tikai viens laiks: {slot1}. Vai der?",
  },
} as const;
