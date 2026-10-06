import { describe, expect, it } from "vitest";
import { DIVISIONS, divisionFor, weekStart } from "@/lib/progress/leaderboard";

describe("weekStart", () => {
  it("returns the Monday of the same week (UTC)", () => {
    // Tue 6 Oct 2026 13:00 UTC → Mon 5 Oct 2026 00:00 UTC
    expect(weekStart(Date.UTC(2026, 9, 6, 13, 0))).toBe(Date.UTC(2026, 9, 5));
    // Sunday 11 Oct → Monday 5 Oct
    expect(weekStart(Date.UTC(2026, 9, 11, 5, 0))).toBe(Date.UTC(2026, 9, 5));
    // Monday itself stays that day
    expect(weekStart(Date.UTC(2026, 9, 5, 0, 0))).toBe(Date.UTC(2026, 9, 5));
    // Just after midnight on Monday
    expect(weekStart(Date.UTC(2026, 9, 5, 0, 1))).toBe(Date.UTC(2026, 9, 5));
  });

  it("never lands in the future and is within 7 days", () => {
    const samples = [
      Date.UTC(2026, 0, 1, 12),
      Date.UTC(2026, 5, 15, 23, 59),
      Date.UTC(2026, 11, 31, 23, 59, 59),
    ];
    for (const now of samples) {
      const start = weekStart(now);
      expect(start).toBeLessThanOrEqual(now);
      expect(now - start).toBeLessThan(7 * 24 * 60 * 60 * 1000);
    }
  });
});

describe("divisionFor", () => {
  it("maps thresholds to divisions", () => {
    expect(divisionFor(0).name).toBe("Bronze");
    expect(divisionFor(99).name).toBe("Bronze");
    expect(divisionFor(100).name).toBe("Silver");
    expect(divisionFor(299).name).toBe("Silver");
    expect(divisionFor(300).name).toBe("Gold");
    expect(divisionFor(699).name).toBe("Gold");
    expect(divisionFor(700).name).toBe("Platinum");
    expect(divisionFor(1_000_000).name).toBe("Platinum");
  });

  it("keeps divisions ascending with no gaps", () => {
    for (let i = 1; i < DIVISIONS.length; i += 1) {
      expect(DIVISIONS[i].min).toBe(DIVISIONS[i - 1].next);
    }
    expect(DIVISIONS[DIVISIONS.length - 1].next).toBeNull();
  });

  it("marks only the top division as having no next", () => {
    expect(divisionFor(700).next).toBeNull();
    expect(divisionFor(699).next).toBe(700);
  });
});
