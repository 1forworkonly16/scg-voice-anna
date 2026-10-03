// Copies the shared data files into src/data/ so the Worker bundle has them.
//   node scripts/sync-data.mjs           copy
//   node scripts/sync-data.mjs --check   exit 1 on drift or a missing source; never writes
// price_model.json  <- ../info/data/price_model.json            (required; info/ is read-only)
// buildings search  <- data/buildings/out/riga_buildings_search.json (WP1 output; required, a missing file fails --check)
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

const FILES = [
  { name: "price_model.json", src: resolve(root, "..", "info", "data", "price_model.json"), dst: join(root, "src", "data", "price_model.json"), required: true },
  {
    name: "riga_buildings_search.json",
    src: join(root, "data", "buildings", "out", "riga_buildings_search.json"),
    dst: join(root, "src", "data", "riga_buildings_search.json"),
    required: true,
  },
];

let failed = false;
for (const f of FILES) {
  const srcOk = existsSync(f.src);
  if (!srcOk) {
    if (f.required) {
      console.error(`[FAIL] ${f.name}: source missing (${f.src})`);
      failed = true;
    } else {
      console.log(`[PENDING] ${f.name}: buildings source pending (${f.src} not written yet); not a failure`);
    }
    continue;
  }
  const dstOk = existsSync(f.dst);
  const same = dstOk && readFileSync(f.src).equals(readFileSync(f.dst));
  if (check) {
    if (same) console.log(`[OK] ${f.name} in sync`);
    else {
      console.error(`[FAIL] ${f.name}: ${dstOk ? "drift" : "missing"} in src/data (run: npm run sync:data)`);
      failed = true;
    }
  } else if (same) {
    console.log(`[OK] ${f.name} already in sync`);
  } else {
    mkdirSync(dirname(f.dst), { recursive: true });
    copyFileSync(f.src, f.dst);
    console.log(`[COPIED] ${f.name}`);
  }
}
process.exit(failed ? 1 : 0);
