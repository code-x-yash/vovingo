export type Rating = "again" | "hard" | "good" | "easy";

export type SrsState = {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
};

export type ScheduleResult = SrsState & {
  status: "learning" | "reviewing" | "known";
};

export const EASE_MIN = 1.3;
export const EASE_MAX = 3.0;
export const INTERVAL_CAP_DAYS = 365;

const DAY_MS = 86_400_000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * SM-2-lite scheduler (deterministic, no randomness):
 *  - again  → lapse: back to square one, due immediately, ease penalty
 *  - hard   → short step, small ease penalty
 *  - good   → 1d → 3d → interval × ease
 *  - easy   → fast track with an ease bonus
 */
export function schedule(state: SrsState, rating: Rating): ScheduleResult {
  let ease = clamp(state.ease, EASE_MIN, EASE_MAX);
  let intervalDays = Math.max(0, state.intervalDays);
  let reps = Math.max(0, state.reps);
  let lapses = Math.max(0, state.lapses);

  if (rating === "again") {
    lapses += 1;
    reps = 0;
    ease = Math.max(EASE_MIN, ease - 0.2);
    return { ease: round2(ease), intervalDays: 0, reps, lapses, status: "learning" };
  }

  reps += 1;

  if (rating === "hard") {
    ease = Math.max(EASE_MIN, ease - 0.15);
    intervalDays = Math.max(1, Math.round(Math.max(intervalDays, 1) * 1.2));
  } else if (rating === "good") {
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 3;
    else intervalDays = Math.max(3, Math.round(Math.max(intervalDays, 1) * ease));
  } else {
    ease = Math.min(EASE_MAX, ease + 0.15);
    intervalDays =
      reps === 1 ? 4 : Math.max(4, Math.round(Math.max(intervalDays, 1) * ease * 1.3));
  }

  intervalDays = Math.min(intervalDays, INTERVAL_CAP_DAYS);
  const status =
    intervalDays >= 21 && reps >= 3 ? "known" : reps >= 2 ? "reviewing" : "learning";
  return { ease: round2(ease), intervalDays, reps, lapses, status };
}

export function nextDueAt(now: Date, intervalDays: number): Date {
  if (intervalDays <= 0) return now;
  return new Date(now.getTime() + intervalDays * DAY_MS);
}
