// Response envelope builders. Every tool answer is HTTP 200 {ok, v, say_ru, say_lv, hint, ...}; say_* come from phrase templates.
import { CONTRACT_VERSION, type ErrorCode } from "../contract";
import { PHRASES } from "../copy/phrases";
import { fillTemplate, renderBoth, type PhraseKey, type PhraseValues } from "../lib/render";
import { EXTRA_PHRASES } from "./say";

export interface Say {
  say_ru: string;
  say_lv: string;
}

export type Body = Record<string, unknown>;

/** Renders a PHRASES key in both languages. */
export function say<K extends PhraseKey>(key: K, values: { ru: PhraseValues<K>; lv: PhraseValues<K> }): Say {
  return renderBoth(PHRASES, key, values);
}

/** Renders a phrase from the local EXTRA_PHRASES table (see say.ts). */
export function sayExtra(key: keyof typeof EXTRA_PHRASES, values: Record<string, string | number> = {}): Say {
  const e = EXTRA_PHRASES[key];
  return { say_ru: fillTemplate(e.ru, values), say_lv: fillTemplate(e.lv, values) };
}

/** EXTRA phrase with language-specific values. */
export function sayExtraBoth(key: keyof typeof EXTRA_PHRASES, values: { ru: Record<string, string | number>; lv: Record<string, string | number> }): Say {
  const e = EXTRA_PHRASES[key];
  return { say_ru: fillTemplate(e.ru, values.ru), say_lv: fillTemplate(e.lv, values.lv) };
}

export const sayGeneric = (): Say => say("tool_error_generic", { ru: {}, lv: {} });

export function ok(s: Say, hint: string, fields: Body = {}): Body {
  return { ok: true, v: CONTRACT_VERSION, say_ru: s.say_ru, say_lv: s.say_lv, hint, ...fields };
}

export function fail(code: ErrorCode, s: Say, hint: string, extra: Body = {}, message?: string): Body {
  return { ok: false, v: CONTRACT_VERSION, say_ru: s.say_ru, say_lv: s.say_lv, hint, error: message ? { code, message } : { code }, ...extra };
}
