// Telegram message texts (HTML, Russian). Every dynamic value is escaped; every message ends with `ДЕМО · <ID>`.
// Money comes from code only (parametricQuote + priceFigures), always «ориентировочно», net AND incl. VAT 21%.
import { parametricQuote, type QuoteInput } from "../lib/quote";
import { priceFigures } from "../lib/speech";
import { formatNumber } from "../lib/words";
import { escapeHtml as esc } from "../routes/util";

export const ROLE_RU: Record<string, string> = {
  owner: "собственник",
  manager: "управляющий",
  board_member: "член правления / старший по дому",
  tenant: "жилец",
  other: "другое",
};

const FOOTER = (id: string) => `ДЕМО · ${esc(id)}`;
const TEST_PREFIX = "[TEST] ";
const head = (isTest: boolean) => (isTest ? TEST_PREFIX : "");
const num = (n: number) => formatNumber(n, "ru", "grouped");

export interface PriceText {
  /** Plain text, already hedged: starts with «Ориентировочно», net and incl. VAT, ends with the inspection sentence. */
  text: string;
  /** Short «от X до Y евро без НДС» for the Sheet. */
  short: string;
}

/** Price sentence for notifications; null when the quote cannot be computed. */
export function priceText(input: QuoteInput): PriceText | null {
  try {
    const f = priceFigures(parametricQuote(input));
    const net = `${num(f.low_net)}–${num(f.high_net)} евро без НДС`;
    const gross = `${num(f.low_gross)}–${num(f.high_gross)} евро с НДС 21%`;
    return {
      text: `Ориентировочно: ${net}, ${gross}. Точную цену даст инженер после бесплатного осмотра.`,
      short: `ориентировочно ${net}; ${gross}`,
    };
  } catch {
    return null;
  }
}

export interface BookingMsg {
  id: string;
  isTest: boolean;
  address: string;
  floors: number;
  stairwells: number;
  apartments: number;
  roleRu: string;
  slotRu: string;
  name: string;
  phone: string;
  notes?: string;
  price: PriceText | null;
  unknown: string[];
  /** Set for a moved booking («перенос»). */
  movedFromRu?: string;
}

/** The brief C §1 line, then price / contact / questions. */
export function bookingMessage(m: BookingMsg): string {
  const lines = [
    `${head(m.isTest)}<b>${m.movedFromRu ? "Перенос осмотра" : "Новая заявка"}</b>: ${esc(m.address)}, ${m.floors} эт., ${m.stairwells} под., ${m.apartments} кв., ${esc(m.roleRu)}, осмотр ${esc(m.slotRu)}`,
  ];
  if (m.movedFromRu) lines.push(`Было: ${esc(m.movedFromRu)}`);
  if (m.notes) lines.push(`Системы и заметки: ${esc(m.notes)}`);
  if (m.price) lines.push(esc(m.price.text));
  lines.push(`Контакт: ${esc(m.name)}, ${esc(m.phone)}`);
  if (m.unknown.length) lines.push(`Вопросы для инженера:\n${m.unknown.map((q) => `- ${esc(q)}`).join("\n")}`);
  lines.push(FOOTER(m.id));
  return lines.join("\n");
}

export interface AccessMsg {
  id: string;
  isTest: boolean;
  address: string;
  apartment: number;
  stairwell: number;
  fromRu: string;
  toRu: string;
}

export function accessMessage(m: AccessMsg): string {
  return [
    `${head(m.isTest)}<b>Перенос доступа в квартиру</b>: ${esc(m.address)}, подъезд ${m.stairwell}, кв. ${m.apartment}`,
    `Было: ${esc(m.fromRu)}`,
    `Стало: ${esc(m.toRu)}`,
    "Прорабу: в пилоте — SMS",
    FOOTER(m.id),
  ].join("\n");
}

export interface CallbackMsg {
  id: string;
  isTest: boolean;
  reason: string;
  summary: string;
  name?: string;
  phone: string;
}

export function callbackMessage(m: CallbackMsg): string {
  return [
    `${head(m.isTest)}<b>Просьба перезвонить</b> (причина: ${esc(m.reason)})`,
    esc(m.summary),
    `Контакт: ${m.name ? `${esc(m.name)}, ` : ""}${esc(m.phone)}`,
    "Перезвонить в рабочее время, пн–пт 9:00–17:00.",
    FOOTER(m.id),
  ].join("\n");
}

export const TICKET_TYPE_RU: Record<string, string> = {
  complaint: "жалоба / повреждение",
  warranty: "случай после работ (гарантия)",
  maintenance: "заявка на обслуживание",
  leak: "течь / протечка",
};

/** Visible placeholder for facts SCG has not given us (on-call contact). Never replaced by an invented value. */
export const UNKNOWN = "[уточнить]";

export interface TicketMsg {
  id: string;
  isTest: boolean;
  type: string;
  /** Urgent ticket or leak: the «СРОЧНО» alert. */
  escalated: boolean;
  address: string;
  apartment?: number;
  /** true = known SCG works site, false = not on the list, null = could not be checked. */
  scgSite: boolean | null;
  description: string;
}

/** «СРОЧНО» alert for urgent / leak tickets; a plain notice otherwise (brief C §7: complaint -> ticket + Telegram). */
export function ticketMessage(m: TicketMsg): string {
  const typeRu = TICKET_TYPE_RU[m.type] ?? m.type;
  const site = m.scgSite === true ? "да (есть в списке объектов)" : m.scgSite === false ? "нет в списке объектов" : "не удалось проверить";
  const lines = [
    m.escalated ? `${head(m.isTest)}<b>СРОЧНО</b>: ${esc(typeRu)}` : `${head(m.isTest)}<b>Новая заявка (обращение)</b>: ${esc(typeRu)}`,
    `Адрес: ${esc(m.address)}${m.apartment ? `, кв. ${m.apartment}` : ""}`,
    `Что случилось: ${esc(m.description)}`,
    `Объект SCG: ${site}`,
  ];
  if (m.escalated) {
    lines.push(`Дежурный мастер: ${UNKNOWN} (в пилоте — звонок и SMS дежурному)`);
    lines.push("Телефон жильца — в заявке на перезвон, если он его оставил.");
  }
  lines.push(FOOTER(m.id));
  return lines.join("\n");
}

export const REQUEST_KIND_RU: Record<string, string> = {
  b2b: "запрос B2B / проект",
  job_candidate: "кандидат на работу",
  emergency_referral: "аварийный звонок (не клиент SCG, направлен в аварийную службу управляющего)",
  admin_message: "сообщение для офиса",
  other: "другое",
};

export interface RequestMsg {
  id: string;
  isTest: boolean;
  kind: string;
  summary: string;
}

/** Short notice for a logged request. */
export function requestMessage(m: RequestMsg): string {
  return [
    `${head(m.isTest)}<b>Новое обращение</b>: ${esc(REQUEST_KIND_RU[m.kind] ?? m.kind)}`,
    esc(m.summary),
    "Контакт — в заявке на перезвон, если он его оставил.",
    FOOTER(m.id),
  ].join("\n");
}

export interface DigestStats {
  date: string;
  calls: number;
  callsOutsideHours: number;
  inspections: number;
  callbacks: number;
  accessChanges: number;
  unknownQuestions: number;
  /** M2: service tickets of the day, of which urgent / leak («СРОЧНО»). */
  tickets: number;
  escalatedTickets: number;
  /** M2: logged requests (B2B, candidates, emergency referrals, admin). */
  requests: number;
  newBuildings: string[];
  isTest: boolean;
}

/** Digest of REAL rows only (the caller already excluded is_test rows). */
export function digestMessage(s: DigestStats): string {
  const lines = [`${head(s.isTest)}<b>Итоги дня ${esc(s.date)}</b>`];
  lines.push(`Звонков: ${s.calls}${s.calls ? ` (вне рабочего времени: ${s.callsOutsideHours})` : ""}`);
  lines.push(`Записано осмотров: ${s.inspections}`);
  lines.push(`Просьб перезвонить: ${s.callbacks}`);
  // M2 lines only when there is something to report, urgent tickets first; the M1 digest text stays unchanged on quiet days
  if (s.escalatedTickets) lines.push(`СРОЧНЫХ заявок (течь / аварии): ${s.escalatedTickets}`);
  if (s.tickets) lines.push(`Заявок на обслуживание и жалоб: ${s.tickets}`);
  if (s.requests) lines.push(`Прочих обращений (B2B, кандидаты, сообщения): ${s.requests}`);
  lines.push(`Переносов доступа жильцов: ${s.accessChanges}`);
  if (s.unknownQuestions) lines.push(`Вопросов для инженера: ${s.unknownQuestions}`);
  if (s.newBuildings.length) lines.push(`Дома в заявках: ${s.newBuildings.map(esc).join("; ")}`);
  lines.push(FOOTER(`D-${s.date}`));
  return lines.join("\n");
}
