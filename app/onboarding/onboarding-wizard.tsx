"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/logo";

const GOALS = [
  "Daily conversations",
  "Travel",
  "Job interviews",
  "Meetings at work",
  "Exams (IELTS/TOEFL)",
  "Studying abroad",
  "Content & media",
  "Making friends",
];

const LANGUAGES = [
  ["hindi", "Hindi"],
  ["bengali", "Bengali"],
  ["tamil", "Tamil"],
  ["telugu", "Telugu"],
  ["marathi", "Marathi"],
  ["kannada", "Kannada"],
  ["malayalam", "Malayalam"],
  ["gujarati", "Gujarati"],
  ["punjabi", "Punjabi"],
  ["urdu", "Urdu"],
  ["spanish", "Spanish"],
  ["portuguese", "Portuguese"],
  ["arabic", "Arabic"],
  ["mandarin", "Mandarin"],
  ["other", "Other"],
] as const;

const LEVELS = [
  { value: "unsure", label: "Not sure — give me the quick placement test", hint: "Recommended · 3 minutes" },
  { value: "complete_beginner", label: "Complete beginner", hint: "I barely know words yet" },
  { value: "beginner", label: "Beginner", hint: "I know basic phrases" },
  { value: "elementary", label: "Elementary", hint: "I can handle simple exchanges" },
  { value: "intermediate", label: "Intermediate", hint: "I can hold a conversation" },
  { value: "upper_intermediate", label: "Upper-intermediate", hint: "I speak fluently with mistakes" },
  { value: "advanced", label: "Advanced", hint: "I want nuance and polish" },
] as const;

const MINUTES = [10, 20, 30, 45] as const;

const chipClass = (active: boolean) =>
  `rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
    active
      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/25"
      : "border-border bg-background hover:bg-muted"
  }`;

const stepLabel = ["Goals", "About you", "Your level"];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [goals, setGoals] = useState<string[]>([]);
  const [nativeLanguage, setNativeLanguage] = useState("hindi");
  const [profession, setProfession] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(20);
  const [englishLevel, setEnglishLevel] = useState<string>("unsure");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function toggleGoal(goal: string) {
    setGoals((g) => (g.includes(goal) ? g.filter((x) => x !== goal) : g.length >= 8 ? g : [...g, goal]));
  }

  async function finish() {
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals, nativeLanguage, profession, dailyMinutes, englishLevel }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        fields?: Record<string, string[]>;
        next?: string;
      };
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setFormError(data.error ?? "Something went wrong.");
        if (data.fields?.goals) setStep(1);
        return;
      }
      router.push(data.next ?? "/dashboard");
      router.refresh();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border/50 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" />
          <span className="text-eyebrow">Setup</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mb-6 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-eyebrow">Vovingo setup</span>
            <span className="font-mono text-eyebrow tabular-nums">
              {step} / 3 · {stepLabel[step - 1]}
            </span>
          </div>
          <Progress value={(step / 3) * 100} className="[&_[data-slot=progress-track]]:h-1.5" />
        </div>

        <div
          key={step}
          className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
        >
          {step === 1 && (
            <div>
              <p className="text-eyebrow">Step one</p>
              <h2 className="text-h2 mt-2 text-balance">What do you want English for?</h2>
              <p className="mt-2 text-[15px]/[17px] text-muted-foreground">
                Pick everything that applies — your plan will be built around these.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {GOALS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={goals.includes(g)}
                    className={chipClass(goals.includes(g))}
                    onClick={() => toggleGoal(g)}
                  >
                    {g}
                  </button>
                ))}
                {errors.goals?.[0] && (
                  <p className="col-span-full text-sm text-destructive">{errors.goals[0]}</p>
                )}
              </div>
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                <p className="text-xs text-muted-foreground">
                  {goals.length} selected · pick at least one
                </p>
                <Button disabled={goals.length === 0} onClick={() => setStep(2)}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-eyebrow">Step two</p>
              <h2 className="text-h2 mt-2 text-balance">Tell us about you</h2>
              <p className="mt-2 text-[15px]/[17px] text-muted-foreground">
                This tunes lesson difficulty and daily workload.
              </p>
              <div className="mt-5 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="nativeLanguage">First language</Label>
                  <select
                    id="nativeLanguage"
                    value={nativeLanguage}
                    onChange={(e) => setNativeLanguage(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {LANGUAGES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profession">What do you do? (optional)</Label>
                  <Input
                    id="profession"
                    placeholder="Student, developer, nurse…"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Daily practice time</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {MINUTES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={dailyMinutes === m}
                        className={chipClass(dailyMinutes === m)}
                        onClick={() => setDailyMinutes(m)}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(3)}>Continue</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-eyebrow">Step three</p>
              <h2 className="text-h2 mt-2 text-balance">How is your English right now?</h2>
              <p className="mt-2 text-[15px]/[17px] text-muted-foreground">
                Honest answers only — this sets your starting difficulty.
              </p>
              <div className="mt-5 space-y-2">
                {LEVELS.map((l) => {
                  const active = englishLevel === l.value;
                  return (
                    <button
                      key={l.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setEnglishLevel(l.value)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary/25"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`grid size-4.5 shrink-0 place-items-center rounded-full border ${
                            active ? "border-primary bg-primary text-primary-foreground" : "border-border"
                          }`}
                        >
                          {active ? <Check className="size-3" /> : null}
                        </span>
                        <span className={`text-sm ${active ? "font-medium text-primary" : "font-medium"}`}>
                          {l.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{l.hint}</span>
                    </button>
                  );
                })}
                {formError && <p className="pt-1 text-sm text-destructive">{formError}</p>}
              </div>
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                <Button variant="ghost" disabled={pending} onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button disabled={pending} onClick={finish}>
                  {pending ? "Saving…" : englishLevel === "unsure" ? "Take the test" : "Finish"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          You can change any of this later from your account settings.
        </p>
      </div>
    </div>
  );
}
