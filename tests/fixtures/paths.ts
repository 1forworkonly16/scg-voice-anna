import { resolve } from "node:path";

/** Absolute path from the repo root (avoids the URL type clash between @cloudflare/workers-types and @types/node). */
export const fromRoot = (...parts: string[]): string => resolve(import.meta.dirname, "..", "..", ...parts);
