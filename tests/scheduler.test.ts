import { describe, expect, it } from "vitest";
import {
  EASE_MIN,
  INTERVAL_CAP_DAYS,
  nextDueAt,
  schedule,
  type SrsState,
} from "../lib/vocab/scheduler";

const fresh: SrsState = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };

describe("schedule", () => {
  it("again resets the card to due-now with an ease penalty", () => {
    const r = schedule({ ease: 2.5, intervalDays: 30, reps: 5, lapses: 1 }, "again");
    expect(r).toEqual({ ease: 2.3, intervalDays: 0, reps: 0, lapses: 2, status: "learning" });
  });

  it("again never drops ease below the floor", () => {
    let s = fresh;
    for (let i = 0; i < 10; i++) s = schedule(s, "again");
    expect(s.ease).toBe(EASE_MIN);
    expect(s.lapses).toBe(10);
  });

  it("good walks the classic 1 → 3 → interval×ease ladder", () => {
    const r1 = schedule(fresh, "good");
    expect(r1.intervalDays).toBe(1);
    expect(r1.reps).toBe(1);
    expect(r1.status).toBe("learning");

    const r2 = schedule(r1, "good");
    expect(r2.intervalDays).toBe(3);
    expect(r2.status).toBe("reviewing");

    const r3 = schedule(r2, "good");
    expect(r3.intervalDays).toBe(Math.round(3 * 2.5)); // 8
    expect(r3.status).toBe("reviewing");

    const r4 = schedule(r3, "good");
    expect(r4.intervalDays).toBe(Math.round(8 * 2.5)); // 20
  });

  it("hard steps gently and eats ease", () => {
    const r1 = schedule(fresh, "hard");
    expect(r1.intervalDays).toBe(1);
    expect(r1.ease).toBe(2.35);
    const r2 = schedule(r1, "hard");
    expect(r2.intervalDays).toBe(Math.round(1 * 1.2)); // 1
    const grown = schedule({ ease: 2.35, intervalDays: 10, reps: 4, lapses: 0 }, "hard");
    expect(grown.intervalDays).toBe(12);
    expect(grown.ease).toBe(2.2);
  });

  it("easy fast-tracks and adds ease", () => {
    const r1 = schedule(fresh, "easy");
    expect(r1.intervalDays).toBe(4);
    expect(r1.ease).toBe(2.65);
    const r2 = schedule(r1, "easy");
    expect(r2.ease).toBe(2.8); // bumps before the interval is computed
    expect(r2.intervalDays).toBe(Math.round(4 * 2.8 * 1.3)); // 15
  });

  it("caps intervals and promotes to known at long range", () => {
    const huge = schedule({ ease: 3, intervalDays: 300, reps: 10, lapses: 0 }, "good");
    expect(huge.intervalDays).toBeLessThanOrEqual(INTERVAL_CAP_DAYS);
    expect(huge.status).toBe("known");

    const long = schedule({ ease: 3, intervalDays: 18, reps: 8, lapses: 0 }, "good");
    expect(long.intervalDays).toBeGreaterThanOrEqual(21);
    expect(long.status).toBe("known");
  });

  it("handles degenerate inputs", () => {
    const r = schedule({ ease: 0.5, intervalDays: -3, reps: -2, lapses: -1 }, "good");
    expect(r.ease).toBeGreaterThanOrEqual(EASE_MIN);
    expect(r.intervalDays).toBe(1);
    expect(r.reps).toBe(1);
    expect(r.lapses).toBe(0);
  });
});

describe("nextDueAt", () => {
  it("returns now for due-immediately cards", () => {
    const now = new Date(2026, 9, 4, 10, 0, 0);
    expect(nextDueAt(now, 0)).toEqual(now);
  });

  it("adds whole days", () => {
    const now = new Date(2026, 9, 4, 10, 0, 0);
    expect(nextDueAt(now, 3)).toEqual(new Date(2026, 9, 7, 10, 0, 0));
  });
});
