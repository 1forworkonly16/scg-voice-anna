import { describe, expect, it } from "vitest";
import { CLEANUP_TABS, parseArgs, selectEvents, selectRows } from "../../scripts/cleanup-live";

const w = { since: new Date("2026-10-04T08:00:00Z"), until: new Date("2026-10-04T12:00:00Z") };
const head = ["timestamp", "conversation_id", "is_test"];

describe("cleanup-live", () => {
  it("never targets Works or Access", () => {
    expect(Object.keys(CLEANUP_TABS)).not.toContain("Works");
    expect(Object.keys(CLEANUP_TABS)).not.toContain("Access");
    expect(selectRows("Works", [head, ["2026-10-04T09:00:00Z", "c", ""]], "timestamp", w)).toBeNull();
  });
  it("selects only non-test rows inside the window and never the header", () => {
    const values = [
      head,
      ["2026-10-04T09:00:00Z", "a", ""], // in window, real -> 1
      ["2026-10-04T09:30:00Z", "b", "TRUE"], // test -> kept
      ["2026-10-03T09:00:00Z", "c", ""], // before -> kept
      ["2026-10-04T13:00:00Z", "d", ""], // after -> kept
      ["2026-10-04T11:59:59Z", "e"], // missing is_test cell = real -> 5
    ];
    expect(selectRows("Leads", values, "timestamp", w)).toEqual([1, 5]);
  });
  it("refuses a tab without the time or is_test column", () => {
    expect(selectRows("Leads", [["timestamp"], ["2026-10-04T09:00:00Z"]], "timestamp", w)).toBeNull();
    expect(selectRows("Leads", [["x", "is_test"]], "timestamp", w)).toBeNull();
  });
  it("selects non-test, non-cancelled events created in the window", () => {
    const ev = [
      { id: "1", created: "2026-10-04T09:00:00Z" },
      { id: "2", created: "2026-10-04T09:00:00Z", extendedProperties: { private: { is_test: "true" } } },
      { id: "3", created: "2026-10-04T09:00:00Z", status: "cancelled" },
      { id: "4", created: "2026-10-01T09:00:00Z" },
      { id: "5", created: "2026-10-04T10:00:00Z", extendedProperties: { private: { is_test: "false" } } },
    ];
    expect(selectEvents(ev, w)).toEqual(["1", "5"]);
  });
  it("is a dry run unless --apply, and bounds the window", () => {
    const now = new Date("2026-10-04T12:00:00Z");
    expect(parseArgs(["--since", "2026-10-04T00:00:00Z"], now).apply).toBe(false);
    expect(parseArgs(["--since=2026-10-04T00:00:00Z", "--apply"], now).apply).toBe(true);
    expect(() => parseArgs([], now)).toThrow();
    expect(() => parseArgs(["--since", "2026-09-01T00:00:00Z"], now)).toThrow();
    expect(() => parseArgs(["--since", "2026-10-04T13:00:00Z"], now)).toThrow();
  });
});
