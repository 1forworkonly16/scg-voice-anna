import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { fromRoot } from "../fixtures/paths";

type Cand = { name: string; values: string[] };
const mod = (await import(/* @vite-ignore */ pathToFileURL(fromRoot("scripts/secret-scan.mjs")).href)) as {
  scanText: (t: string) => { line: number; id: string }[];
  scanExact: (t: string, c: Cand[]) => { line: number; name: string }[];
  envNamesFromSetupDoc: (md: string) => string[];
  candidateValues: (raw: string) => string[];
};

// All fake secrets are assembled at runtime so this file itself stays clean for the real scan.
const rep = (c: string, n: number) => c.repeat(n);
const ids = (t: string) => mod.scanText(t).map((h) => h.id);

describe("secret-scan: key patterns", () => {
  it("flags typical key shapes", () => {
    expect(ids(`key = "${"sk" + "_" + rep("a1", 14)}"`)).toContain("sk-key");
    expect(ids(`k=${"sk" + "-ant-" + rep("Ab9", 10)}`)).toContain("sk-key");
    expect(ids(`${"xi-api" + "-key"}: ${rep("a1b2", 8)}`)).toContain("xi-api-key-value");
    expect(ids(`-----${"BEGIN"} PRIVATE KEY-----`)).toContain("private-key-pem");
    expect(ids(`-----${"BEGIN"} RSA PRIVATE KEY-----`)).toContain("private-key-pem");
    expect(ids(`token ${"123456789"}:${rep("Ab_", 12).slice(0, 35)}`)).toContain("telegram-bot-token");
    expect(ids(`k=${"AI" + "za"}${rep("Sy-", 12).slice(0, 35)}`)).toContain("google-api-key");
    expect(ids(`client_secret = "${rep("0f", 24)}"`)).toContain("long-hex-secret");
  });
  it("does not flag env references, hashes without context, or plain prose", () => {
    expect(ids(`${"xi-api" + "-key"}: $env:ELEVENLABS_API_KEY`)).toEqual([]);
    expect(ids(`"price_model_sha256":"${rep("ab12", 16)}"`)).toEqual([]);
    expect(ids("Секреты хранятся только в переменных среды Windows.")).toEqual([]);
    expect(ids("sk_ prefix is documented here")).toEqual([]);
  });
  it("reports line numbers and never an excerpt", () => {
    const hits = mod.scanText(`ok\n${"sk" + "_" + rep("a1", 14)}`);
    expect(hits).toEqual([{ line: 2, id: "sk-key" }]);
  });
});

describe("secret-scan: exact values of env vars", () => {
  const value = `Zq9${rep("x7K", 8)}`;
  it("finds the value, names the variable, never prints the value", () => {
    const hits = mod.scanExact(`a\nconst v = "${value}";\n`, [{ name: "SOME_VAR", values: [value] }]);
    expect(hits).toEqual([{ line: 2, name: "SOME_VAR" }]);
    expect(JSON.stringify(hits)).not.toContain(value);
  });
  it("ignores short or empty values", () => {
    expect(mod.scanExact("abc123", [{ name: "X", values: ["abc123", ""] }])).toEqual([]);
  });
  it("derives extra needles from a service-account JSON", () => {
    const pem = `-----${"BEGIN"} PRIVATE KEY-----\n${rep("MIIE", 20)}\n-----END PRIVATE KEY-----\n`;
    const raw = JSON.stringify({ client_email: "sa@example.iam", private_key: pem, private_key_id: rep("ab", 20) });
    const vals = mod.candidateValues(raw);
    expect(vals.length).toBeGreaterThan(3);
    expect(vals).toContain(rep("ab", 20));
    // the escaped key (as it appears inside a JSON file) is found
    expect(mod.scanExact(`{"private_key":"${pem.replace(/\n/g, "\\n")}"}`, [{ name: "GOOGLE_SA_KEY_JSON", values: vals }]).length).toBeGreaterThan(0);
  });
});

describe("secret-scan: env names come from docs/setup_keys.md", () => {
  it("parses the table", () => {
    const md = "| Variable | Set by |\n|---|---|\n| `ELEVENLABS_API_KEY` | You |\n| `GOOGLE_SA_KEY_JSON` | Sub |\ntext `NOT_A_ROW`";
    expect(mod.envNamesFromSetupDoc(md)).toEqual(["ELEVENLABS_API_KEY", "GOOGLE_SA_KEY_JSON"]);
  });
});
