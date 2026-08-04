import { describe, expect, it } from "vitest";
import {
  DAILY_SPOTLIGHT_COUNT,
  pickDailySpotlight,
  utcDayIndex,
} from "../shared/daily";

function people(...ids: string[]) {
  return ids.map((id) => ({ id, name: id }));
}

describe("utcDayIndex", () => {
  it("is stable for any time within the same UTC day", () => {
    const a = utcDayIndex(new Date("2026-08-03T00:00:00Z"));
    const b = utcDayIndex(new Date("2026-08-03T23:59:59Z"));
    expect(a).toBe(b);
  });

  it("advances on the next UTC day", () => {
    const a = utcDayIndex(new Date("2026-08-03T12:00:00Z"));
    const b = utcDayIndex(new Date("2026-08-04T00:00:00Z"));
    expect(b).toBe(a + 1);
  });
});

describe("pickDailySpotlight", () => {
  it("returns an empty list for an empty pool", () => {
    expect(pickDailySpotlight([], { dayIndex: 0 })).toEqual([]);
  });

  it("excludes the viewer", () => {
    const picked = pickDailySpotlight(people("a", "b", "c"), {
      excludeId: "b",
      dayIndex: 0,
      count: 5,
    });
    expect(picked.map((p) => p.id)).toEqual(["a", "c"]);
    expect(picked.every((p) => p.id !== "b")).toBe(true);
  });

  it("returns the whole pool when smaller than the count", () => {
    const picked = pickDailySpotlight(people("c", "a", "b"), {
      dayIndex: 0,
      count: 5,
    });
    expect(picked.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by id before slicing", () => {
    const picked = pickDailySpotlight(people("m3", "m1", "m2", "m5", "m4", "m6"), {
      dayIndex: 0,
      count: 5,
    });
    expect(picked.map((p) => p.id)).toEqual(["m1", "m2", "m3", "m4", "m5"]);
  });

  it("advances a non-overlapping window each day", () => {
    const pool = people("a", "b", "c", "d", "e", "f", "g", "h", "i", "j");
    const day0 = pickDailySpotlight(pool, { dayIndex: 0, count: 5 }).map((p) => p.id);
    const day1 = pickDailySpotlight(pool, { dayIndex: 1, count: 5 }).map((p) => p.id);
    expect(day0).toEqual(["a", "b", "c", "d", "e"]);
    expect(day1).toEqual(["f", "g", "h", "i", "j"]);
  });

  it("wraps around the end of the pool", () => {
    const pool = people("a", "b", "c", "d", "e", "f", "g");
    // dayIndex 1 → start = (1 * 5) % 7 = 5 → f, g, a, b, c
    const picked = pickDailySpotlight(pool, { dayIndex: 1, count: 5 }).map((p) => p.id);
    expect(picked).toEqual(["f", "g", "a", "b", "c"]);
  });

  it("defaults to DAILY_SPOTLIGHT_COUNT", () => {
    const pool = people(...Array.from({ length: 20 }, (_, i) => `p${String(i).padStart(2, "0")}`));
    expect(pickDailySpotlight(pool, { dayIndex: 0 })).toHaveLength(DAILY_SPOTLIGHT_COUNT);
  });

  it("gives everyone roughly equal exposure over a full cycle", () => {
    const pool = people(...Array.from({ length: 12 }, (_, i) => `p${String(i).padStart(2, "0")}`));
    const counts = new Map<string, number>();
    for (const p of pool) counts.set(p.id, 0);
    // Cycle length in days until the window pattern repeats: pool.length when
    // start = (day * n) % L wraps through every offset that is a multiple of gcd(n, L).
    // Over enough days everyone appears a similar number of times.
    for (let day = 0; day < 60; day++) {
      for (const p of pickDailySpotlight(pool, { dayIndex: day, count: 5 })) {
        counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
      }
    }
    const values = [...counts.values()];
    const min = Math.min(...values);
    const max = Math.max(...values);
    expect(max - min).toBeLessThanOrEqual(1);
  });
});
