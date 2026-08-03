/** How many people to spotlight each day (capped by pool size). */
export const DAILY_SPOTLIGHT_COUNT = 5;

const MS_PER_DAY = 86_400_000;

/** UTC day index since Unix epoch (stable across the academy). */
export function utcDayIndex(now: Date = new Date()): number {
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / MS_PER_DAY);
}

/**
 * Fair daily rotation: exclude the viewer, sort by id, then take a
 * non-overlapping window of `count` people that advances each UTC day.
 */
export function pickDailySpotlight<T extends { id: string }>(
  items: T[],
  opts: {
    excludeId?: string | null;
    count?: number;
    /** Override for tests; defaults to today's UTC day index. */
    dayIndex?: number;
  } = {},
): T[] {
  const count = opts.count ?? DAILY_SPOTLIGHT_COUNT;
  const pool = items
    .filter((item) => item.id !== opts.excludeId)
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (pool.length === 0 || count <= 0) return [];

  const n = Math.min(count, pool.length);
  const day = opts.dayIndex ?? utcDayIndex();
  const start = (day * n) % pool.length;

  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}
