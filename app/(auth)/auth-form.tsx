"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "signup";

function safeNext(next: string | undefined): string | null {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const isSignup = mode === "signup";
  const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSignup ? { name, email, password } : { email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        fields?: Record<string, string[]>;
        redirectTo?: string;
      };
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setFormError(data.fields?.form?.[0] ?? data.error ?? "Something went wrong. Please try again.");
        return;
      }
      const target = safeNext(next) ?? data.redirectTo ?? "/dashboard";
      router.push(target);
      router.refresh();
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="animate-fade-up rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <p className="text-eyebrow">{isSignup ? "New account" : "Account"}</p>
      <h1 className="text-h2 mt-2">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-[15px]/[17px] text-muted-foreground">
        {isSignup
          ? "A coach that remembers everything you get wrong — and turns it into a daily plan."
          : "Sign in to continue your practice."}
      </p>

      <form onSubmit={onSubmit} className="mt-6">
        <div className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}
          {isSignup && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name?.[0] && <p className="text-sm text-destructive">{errors.name[0]}</p>}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email?.[0] && <p className="text-sm text-destructive">{errors.email[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "At least 8 characters, with a number" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password?.[0] && <p className="text-sm text-destructive">{errors.password[0]}</p>}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Button type="submit" className="h-10 w-full" size="lg" disabled={pending}>
            {pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
            {!pending ? <ArrowRight className="size-4" /> : null}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link
                  href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link
                  href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </form>
    </div>
  );
}
