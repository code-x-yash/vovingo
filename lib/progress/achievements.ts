export type AchievementStats = {
  lessons: number;
  conversations: number;
  speakingSessions: number;
  streak: number;
  words: number;
  speakingMinutes: number;
  resolvedMistakes: number;
  mistakePractices: number;
  assessments: number;
  planDays: number;
};

export type AchievementRow = {
  id: number;
  key: string;
  title: string;
  description: string;
  icon: string | null;
  xp: number;
  criteria: Record<string, unknown>;
};

/**
 * An achievement unlocks when every numeric criterion is met
 * (`stats[key] >= threshold`). Empty or unrecognised criteria never unlock —
 * a typo in seed content must not auto-award.
 */
export function criterionMet(stats: AchievementStats, criteria: Record<string, unknown>): boolean {
  const entries = Object.entries(criteria).filter(([, v]) => typeof v === "number");
  if (entries.length === 0) return false;
  for (const [key, threshold] of entries) {
    const have = stats[key as keyof AchievementStats];
    if (typeof have !== "number" || have < (threshold as number)) return false;
  }
  return true;
}

/** Pure unlock decision: catalog + stats + already-earned ids → rows to unlock. */
export function evaluateAchievements(
  catalog: AchievementRow[],
  stats: AchievementStats,
  earnedIds: ReadonlySet<number>
): AchievementRow[] {
  return catalog.filter((a) => !earnedIds.has(a.id) && criterionMet(stats, a.criteria));
}
