export const MISTAKE_CATEGORY_LABEL: Record<string, string> = {
  grammar: "Grammar",
  vocab: "Vocabulary",
  pronunciation: "Pronunciation",
  fluency: "Fluency",
  naturalness: "Naturalness",
  style: "Style",
  listening: "Listening",
};

export const MISTAKE_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  needs_practice: "Needs practice",
  improving: "Improving",
  resolved: "Resolved",
};

export const MISTAKE_TREND_LABEL: Record<string, string> = {
  new: "New",
  stable: "Stable",
  improving: "Improving",
  worsening: "Worsening",
};

export const MISTAKE_SEVERITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function statusTone(status: string): string {
  if (status === "needs_practice") return "border-destructive/40 text-destructive";
  if (status === "improving") return "border-primary/40 text-primary";
  return "border-border text-muted-foreground";
}

export function trendTone(trend: string): string {
  if (trend === "worsening") return "border-destructive/40 text-destructive";
  if (trend === "improving") return "border-primary/40 text-primary";
  return "border-border text-muted-foreground";
}

export function severityTone(severity: string): string {
  if (severity === "high") return "border-destructive/40 text-destructive";
  if (severity === "medium") return "border-border text-foreground";
  return "border-border text-muted-foreground";
}

/** e.g. "Oct 4" — for occurrence dates in lists. */
export function shortDate(value: Date | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
