// Mints a short-lived SA access token (RS256 JWT -> oauth2 token). Key from env GOOGLE_SA_KEY_JSON; prints ONLY the token.
import { createSign } from "node:crypto";
const key = JSON.parse(process.env.GOOGLE_SA_KEY_JSON || "{}");
if (!key.private_key) { console.error("GOOGLE_SA_KEY_JSON missing"); process.exit(2); }
const scope = process.argv[2];
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: key.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3300 });
const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key).toString("base64url");
const r = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + sig }),
});
const j = await r.json();
if (!j.access_token) { console.error("token error:", j.error, j.error_description); process.exit(1); }
process.stdout.write(j.access_token);
