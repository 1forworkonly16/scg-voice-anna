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

export interface DigestStats {
  date: string;
  calls: number;
  callsOutsideHours: number;
  inspections: number;
  callbacks: number;
  accessChanges: number;
  unknownQuestions: number;
  newBuildings: string[];
  isTest: boolean;
}

/** Digest of REAL rows only (the caller already excluded is_test rows). */
export function digestMessage(s: DigestStats): string {
  const lines = [`${head(s.isTest)}<b>Итоги дня ${esc(s.date)}</b>`];
  lines.push(`Звонков: ${s.calls}${s.calls ? ` (вне рабочего времени: ${s.callsOutsideHours})` : ""}`);
  lines.push(`Записано осмотров: ${s.inspections}`);
  lines.push(`Просьб перезвонить: ${s.callbacks}`);
  lines.push(`Переносов доступа жильцов: ${s.accessChanges}`);
  if (s.unknownQuestions) lines.push(`Вопросов для инженера: ${s.unknownQuestions}`);
  if (s.newBuildings.length) lines.push(`Дома в заявках: ${s.newBuildings.map(esc).join("; ")}`);
  lines.push(FOOTER(`D-${s.date}`));
  return lines.join("\n");
}
