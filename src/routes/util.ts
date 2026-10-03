// Small helpers: timeouts, constant-time compare, hex/sha256/base64url, HTML escaping, ids.
export class TimeoutError extends Error {
  constructor(what: string, ms: number) {
    super(`${what} timed out after ${ms} ms`);
    this.name = "TimeoutError";
  }
}

/** Races a promise against a timer. The loser keeps running but its result is ignored. */
export function withTimeout<T>(p: Promise<T>, ms: number, what: string, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        /* ignore */
      }
      reject(new TimeoutError(what, ms));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Secrets pasted on Windows may carry CR/LF or spaces. */
export const cleanSecret = (s: string | undefined | null): string => (s ?? "").replace(/[\r\n]+/g, "").trim();

const enc = new TextEncoder();

export function bytesToHex(b: ArrayBuffer | Uint8Array): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const x of u) s += x.toString(16).padStart(2, "0");
  return s;
}

export async function sha256Hex(text: string): Promise<string> {
  return bytesToHex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

export function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const u = typeof input === "string" ? enc.encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = "";
  for (const x of u) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time string equality (both sides are hashed first, so length does not leak). Empty never matches. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  if (!a || !b) return false;
  const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

export const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function randomHex(chars: number): string {
  const b = new Uint8Array(Math.ceil(chars / 2));
  crypto.getRandomValues(b);
  return bytesToHex(b).slice(0, chars);
}

/** Conversations and rows made by automated tests (integration tests, ElevenLabs Tests) carry [TEST] / test- markers. */
export function isTestMarker(conversationId: string | undefined, name?: string | undefined): boolean {
  return /^\[?test\]?[-_ :]?/i.test(conversationId ?? "") || /^\s*\[test\]/i.test(name ?? "");
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
