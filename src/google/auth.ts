// Google service-account access token: RS256 JWT signed with WebCrypto, exchanged at oauth2.googleapis.com,
// cached per isolate (about 1 h) and de-duplicated while a request is in flight. Pre-warmed during lookup_building.
import { base64url, cleanSecret, withTimeout } from "../routes/util";
import type { Deps } from "../routes/types";
import { GoogleError } from "./errors";

export const SCOPES = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SAFETY_MS = 120_000;

interface Cached {
  key: string;
  token: string;
  expiresAt: number;
}

let cached: Cached | null = null;
let inflight: { key: string; p: Promise<string> } | null = null;
let signingKey: { raw: string; key: CryptoKey } | null = null;

export function resetGoogleTokenCache(): void {
  cached = null;
  inflight = null;
  signingKey = null;
}

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export function parseServiceAccount(raw: string): ServiceAccount {
  let o: Partial<ServiceAccount>;
  try {
    o = JSON.parse(cleanSecret(raw)) as Partial<ServiceAccount>;
  } catch {
    throw new GoogleError("config", "GOOGLE_SA_KEY_JSON is not valid JSON");
  }
  if (!o.client_email || !o.private_key) throw new GoogleError("config", "GOOGLE_SA_KEY_JSON lacks client_email / private_key");
  return { client_email: o.client_email, private_key: o.private_key };
}

async function importKey(pem: string): Promise<CryptoKey> {
  if (signingKey && signingKey.raw === pem) return signingKey.key;
  const b64 = pem
    .split("\\n")
    .join("\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  signingKey = { raw: pem, key };
  return key;
}

export async function signJwt(sa: ServiceAccount, nowSec: number): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({ iss: sa.client_email, scope: SCOPES, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 }));
  const data = `${header}.${claim}`;
  const key = await importKey(sa.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return `${data}.${base64url(sig)}`;
}

async function fetchToken(deps: Deps, sa: ServiceAccount): Promise<Cached> {
  let jwt: string;
  try {
    jwt = await signJwt(sa, Math.floor(deps.now().getTime() / 1000));
  } catch {
    throw new GoogleError("config", "cannot sign JWT (bad private key)");
  }
  const ctrl = new AbortController();
  let res: Response;
  try {
    res = await withTimeout(
      deps.fetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
        signal: ctrl.signal,
      }),
      deps.limits.googleMs,
      "google token",
      () => ctrl.abort(),
    );
  } catch (e) {
    throw new GoogleError(e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network", "token request failed");
  }
  if (!res.ok) throw new GoogleError("auth", `token endpoint answered ${res.status}`, res.status);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new GoogleError("auth", "token endpoint returned no access_token");
  return { key: sa.client_email, token: body.access_token, expiresAt: deps.now().getTime() + (body.expires_in ?? 3600) * 1000 };
}

/** Access token (cached about 1 h per isolate). Costs 1 subrequest only on a cache miss. */
export async function getAccessToken(deps: Deps): Promise<string> {
  const sa = parseServiceAccount(deps.env.GOOGLE_SA_KEY_JSON);
  const now = deps.now().getTime();
  if (cached && cached.key === sa.client_email && cached.expiresAt - SAFETY_MS > now) return cached.token;
  if (inflight && inflight.key === sa.client_email) return inflight.p;
  const p = fetchToken(deps, sa)
    .then((c) => {
      cached = c;
      return c.token;
    })
    .finally(() => {
      inflight = null;
    });
  inflight = { key: sa.client_email, p };
  return p;
}

/** Fire-and-forget warm-up; never throws. */
export function prewarmToken(deps: Deps): void {
  if (!cleanSecret(deps.env.GOOGLE_SA_KEY_JSON)) return;
  deps.waitUntil(getAccessToken(deps).then(() => undefined, () => undefined));
}
