// Daily digest from REAL Sheet rows only (is_test rows are excluded). One batchGet, one Telegram message.
import { isOfficeOpen, rigaYmd } from "../lib/time";
import { readTabs } from "../google/sheets";
import { digestMessage, type DigestStats } from "../notify/messages";
import { sendTelegram, type SendResult } from "../notify/telegram";
import type { Deps } from "../routes/types";

const isTestRow = (r: Record<string, unknown>) => String(r.is_test ?? "").toUpperCase() === "TRUE";

function onDate(ts: unknown, date: string): boolean {
  const ms = Date.parse(String(ts ?? ""));
  return Number.isFinite(ms) && rigaYmd(new Date(ms)) === date;
}

export async function computeDigest(deps: Deps, date?: string, isTest = false): Promise<DigestStats> {
  const day = date ?? rigaYmd(deps.now());
  const tabs = await readTabs(deps, ["Leads", "Calls", "Callbacks", "Access"]);
  const real = (name: string) => (tabs[name] ?? []).filter((r) => !isTestRow(r) && onDate(name === "Access" ? r.created_at : r.timestamp, day));
  const leads = real("Leads");
  const calls = real("Calls");
  const booked = leads.filter((r) => String(r.status) === "inspection_booked");
  const buildings = [...new Set(booked.map((r) => String(r.address ?? "")).filter(Boolean))];
  return {
    date: day,
    calls: calls.length,
    callsOutsideHours: calls.filter((r) => !isOfficeOpen(new Date(Date.parse(String(r.timestamp))))).length,
    inspections: booked.length,
    callbacks: real("Callbacks").length,
    accessChanges: real("Access").length,
    unknownQuestions: leads.filter((r) => String(r.unknown_questions ?? "").trim() !== "").length,
    newBuildings: buildings,
    isTest,
  };
}

export async function sendDigest(deps: Deps, opts: { date?: string; test?: boolean; dry?: boolean } = {}): Promise<{ text: string; stats: DigestStats; sent?: SendResult }> {
  const stats = await computeDigest(deps, opts.date, Boolean(opts.test));
  const text = digestMessage(stats);
  if (opts.dry) return { text, stats };
  return { text, stats, sent: await sendTelegram(deps, text, Boolean(opts.test)) };
}
