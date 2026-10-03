// Emits the ElevenLabs webhook-tool definition for a tool, derived from the zod schemas (never hand-written).
// The URL is a PARAMETER (the Worker URL is not known at build time); the x-scg-key header references a workspace
// secret. WP8 wraps the result as POST /v1/convai/tools {tool_config: {type: "webhook", ...}}.
import { z } from "zod";
import { TOOLS, type ToolName } from "./schemas";

export interface ElevenLabsToolOptions {
  /** Worker base URL without a trailing slash. Default: the literal placeholder "{base_url}". */
  baseUrl?: string;
  /** Id of the ElevenLabs workspace secret that holds the tool key. Default: the literal placeholder "{secret_id}". */
  secretId?: string;
}

type JsonProp = { type: string; description: string; enum?: unknown[]; items?: { type: string; enum?: unknown[] }; dynamic_variable?: string };

/** Fields the platform fills itself instead of the LLM. */
const DYNAMIC: Record<string, string> = { conversation_id: "system__conversation_id" };

interface RawProp {
  type?: string;
  description?: string;
  enum?: unknown[];
  items?: { type?: string; enum?: unknown[] };
}

export function toElevenLabsTool(name: ToolName, opts: ElevenLabsToolOptions = {}) {
  const tool = TOOLS[name];
  const js = z.toJSONSchema(tool.input, { io: "input", unrepresentable: "any" }) as { properties: Record<string, RawProp>; required?: string[] };
  const properties: Record<string, JsonProp> = {};
  for (const [key, raw] of Object.entries(js.properties)) {
    if (!raw.description) throw new Error(`tool ${name}: property ${key} has no description`);
    const prop: JsonProp = { type: raw.type ?? "string", description: raw.description };
    if (raw.enum) prop.enum = raw.enum;
    if (raw.type === "array") {
      prop.items = { type: raw.items?.type ?? "string" };
      if (raw.items?.enum) prop.items.enum = raw.items.enum;
    }
    const dyn = DYNAMIC[key];
    if (dyn) prop.dynamic_variable = dyn;
    properties[key] = prop;
  }
  const baseUrl = (opts.baseUrl ?? "{base_url}").replace(/\/+$/, "");
  return {
    name,
    description: tool.description,
    response_timeout_secs: tool.timeoutSecs,
    api_schema: {
      url: `${baseUrl}/tools/${name}`,
      method: "POST",
      content_type: "application/json",
      request_headers: { "x-scg-key": { secret_id: opts.secretId ?? "{secret_id}" } },
      request_body_schema: {
        type: "object",
        description: `Request body of ${name}.`,
        required: js.required ?? [],
        properties,
      },
    },
  };
}
