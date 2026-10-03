// One authorised Google API call: bearer token, 3.5 s timeout, JSON in/out, typed errors (messages never carry tokens or bodies).
import type { Deps } from "../routes/types";
import { withTimeout } from "../routes/util";
import { getAccessToken } from "./auth";
import { GoogleError } from "./errors";

export interface GoogleResult<T> {
  status: number;
  ok: boolean;
  data: T | null;
}

/** Non-2xx answers come back as a result (so callers can handle 404 / 409); network errors and timeouts throw GoogleError. */
export async function googleCall<T = unknown>(deps: Deps, method: string, url: string, body?: unknown): Promise<GoogleResult<T>> {
  const token = await getAccessToken(deps);
  const ctrl = new AbortController();
  let res: Response;
  try {
    res = await withTimeout(
      deps.fetch(url, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      }),
      deps.limits.googleMs,
      "google api",
      () => ctrl.abort(),
    );
  } catch (e) {
    throw new GoogleError(e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network", `${method} failed`);
  }
  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

export function assertOk<T>(r: GoogleResult<T>, what: string): T {
  if (!r.ok || r.data === null) throw new GoogleError("http", `${what} answered ${r.status}`, r.status);
  return r.data;
}
