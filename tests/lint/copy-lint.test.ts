import { mkdtempSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { fromRoot } from "../fixtures/paths";

type Hit = { file: string; line: number; rule: string; id: string };
const mod = (await import(/* @vite-ignore */ pathToFileURL(fromRoot("scripts/copy-lint.mjs")).href)) as {
  lintText: (text: string, file?: string) => Hit[];
};
const rules = (text: string) => mod.lintText(text).map((h) => `${h.rule}:${h.id}`);

describe("copy-lint: banned phrases", () => {
  it.each([
    ["Это выйдет за полцены!", "banned:za-polceny"],
    ["Вы сможете вдвойне сэкономить.", "banned:vdvoe-sekonomit"],
    ["Мы гарантированно дешевле управляющего.", "banned:garantirovanno-deshevle"],
    ["Ваш управляющий завышает цены.", "banned:upravlyayuschiy-zavyshaet"],
    ["Tas izmaksās par pusi cenas.", "banned:lv-par-pusi-cenas"],
    ["Jūs varēsiet divreiz ietaupīt.", "banned:lv-divreiz-ietaupit"],
    ["RNP — наш клиент.", "banned:rnp-client"],
    ["Мы работаем с RNP как партнёр RNP", "banned:rnp-client"],
  ])("flags: %s", (text, expected) => {
    expect(rules(text)).toContain(expected);
  });
  it("does not flag clean copy", () => {
    expect(rules("Мы заменяем стояки в домах Риги. Бесплатный осмотр, цену даст инженер.")).toEqual([]);
  });
});

describe("copy-lint: prices need «ориентировочно» in the same sentence", () => {
  it("flags a euro amount without the hedge", () => {
    expect(rules("Это стоит 84000 евро без НДС.")).toContain("price:euro-without-orientirovochno");
    expect(rules("Tas maksās 84 000 eiro.")).toContain("price:euro-without-orientirovochno");
    expect(rules("Цена от € 500.")).toContain("price:euro-without-orientirovochno");
    expect(rules('ru: "от {low_net} до {high_net} евро без НДС"')).toContain("price:euro-without-orientirovochno");
  });
  it("accepts the hedge in the same sentence, RU and LV", () => {
    expect(rules("Ориентировочно от 84000 до 125000 евро без НДС.")).toEqual([]);
    expect(rules("Orientējoši no 84 000 līdz 125 000 eiro bez PVN.")).toEqual([]);
    expect(rules('ru: "Ориентировочно для вашего дома — от {low_net} до {high_net} евро без НДС. Точную цену даст инженер."')).toEqual([]);
  });
  it("a hedge in another sentence does not help", () => {
    expect(rules("Ориентировочно, это недорого. Это стоит 5000 евро.")).toContain("price:euro-without-orientirovochno");
  });
  it("mentions of the currency without an amount are fine", () => {
    expect(rules("Цены указаны в евро.")).toEqual([]);
  });
});

describe("copy-lint: promises and placeholders", () => {
  it.each([
    "Мы пришлём SMS с подтверждением.",
    "Мы отправим вам письмо.",
    "Nosūtīsim SMS ar apstiprinājumu.",
    "Mēs jums atsūtīsim uz e-pastu.",
  ])("flags promise: %s", (t) => {
    expect(mod.lintText(t).some((h) => h.rule === "promise")).toBe(true);
  });
  it("flags [уточнить] in spoken text", () => {
    expect(rules("Гарантия составляет [уточнить] лет.")).toContain("placeholder:utochnit");
  });
});

describe("copy-lint: never-lists and markers", () => {
  it("ignores never-sections, marked blocks and ignore-lines", () => {
    expect(rules(["## Never-list", "- за полцены", "- пришлём SMS", "## Next", "text"].join("\n"))).toEqual([]);
    expect(rules(["<!-- copy-lint:off -->", "за полцены", "<!-- copy-lint:on -->", "за полцены"].join("\n")).length).toBe(1);
    expect(rules("за полцены // copy-lint:ignore")).toEqual([]);
  });
  it("loophole A closed: a prohibition word on a spoken line exempts nothing", () => {
    expect(rules("Никогда не говори «за полцены».")).toEqual(["banned:za-polceny"]);
    expect(rules("Never say «за полцены».")).toEqual(["banned:za-polceny"]);
    expect(rules("Нельзя, но мы пришлём SMS.")).toContain("promise:ru-send-sms");
    expect(rules("Don't worry, это стоит 5000 евро.")).toContain("price:euro-without-orientirovochno");
    expect(rules("Это нельзя: [уточнить]")).toContain("placeholder:utochnit");
  });
  it("loophole B closed: copy-lint:off without copy-lint:on is an error", () => {
    const hits = mod.lintText(["ok", "<!-- copy-lint:off -->", "за полцены", "ещё текст"].join("\n"), "x.md");
    expect(hits).toEqual([{ file: "x.md", line: 2, rule: "marker", id: "copy-lint-off-never-closed" }]);
    expect(rules(["<!-- copy-lint:off -->", "текст", "<!-- copy-lint:on -->"].join("\n"))).toEqual([]);
  });
  it("a never-section ends at the next heading of the same level", () => {
    expect(rules("## Нельзя\nза полцены\n## Стиль\nза полцены")).toEqual(["banned:za-polceny"]);
  });
  it("reports file and line", () => {
    const h = mod.lintText("ok\nза полцены", "x.md");
    expect(h).toEqual([{ file: "x.md", line: 2, rule: "banned", id: "za-polceny" }]);
  });
});

describe("copy-lint CLI", () => {
  it("exit 1 on a bad file, 0 on a clean one, skips missing default directories", () => {
    const dir = mkdtempSync(join(tmpdir(), "scg-lint-"));
    const bad = join(dir, "bad.md");
    const good = join(dir, "good.md");
    writeFileSync(bad, "Это за полцены.\n");
    writeFileSync(good, "Ориентировочно от 1000 евро.\n");
    const run = (f: string) => spawnSync("node", [fromRoot("scripts/copy-lint.mjs"), f], { encoding: "utf8" });
    expect(run(bad).status).toBe(1);
    expect(run(bad).stderr).toContain("za-polceny");
    expect(run(good).status).toBe(0);
    const out = execFileSync("node", [fromRoot("scripts/copy-lint.mjs"), join(dir, "missing-dir")], { encoding: "utf8" });
    expect(out).toContain("0 file(s) scanned");
  });
});
