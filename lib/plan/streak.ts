import { todayKey } from "./generate";

export type StreakState = {
  current: number;
  longest: number;
  totalDays: number;
  lastActiveDate: string | null;
  xp: number;
};

export const EMPTY_STREAK: StreakState = {
  current: 0,
  longest: 0,
  totalDays: 0,
  lastActiveDate: null,
  xp: 0,
};

export const XP_PER_ITEM = 10;
export const XP_PLAN_BONUS = 50;

export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

/**
 * Pure streak reducer. Same-day activity only adds XP;
 * consecutive days extend the streak, gaps reset it to 1.
 */
export function applyActivity(state: StreakState, today: string, xpGain: number): StreakState {
  if (state.lastActiveDate === today) {
    return { ...state, xp: state.xp + xpGain };
  }

  const current = state.lastActiveDate === shiftDay(today, -1) ? state.current + 1 : 1;
  return {
    current,
    longest: Math.max(state.longest, current),
    totalDays: state.totalDays + 1,
    lastActiveDate: today,
    xp: state.xp + xpGain,
  };
}
