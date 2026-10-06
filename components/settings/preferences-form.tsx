"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GOALS = [10, 20, 30, 45];

export function PreferencesForm({
  initialGoal,
  initialReminder,
}: {
  initialGoal: number;
  initialReminder: string | null;
}) {
  const router = useRouter();
  const [goal, setGoal] = useState(GOALS.includes(initialGoal) ? initialGoal : 20);
  const [reminder, setReminder] = useState(initialReminder ?? "");
  const [pending, setPending] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyGoalMinutes: goal,
          workoutReminderAt: reminder || null,
        }),
      });
      if (res.ok) {
        toast.success("Preferences saved.");
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Could not save preferences.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-4 space-y-4">
      <div className="space-y-2">
        <Label>Daily practice goal</Label>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <Button
              key={g}
              type="button"
              variant={goal === g ? "default" : "outline"}
              onClick={() => setGoal(g)}
            >
              {g} min
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reminder">Daily reminder time (optional)</Label>
        <Input
          id="reminder"
          type="time"
          value={reminder}
          onChange={(e) => setReminder(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Used for the daily workout nudge when notifications are enabled.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
