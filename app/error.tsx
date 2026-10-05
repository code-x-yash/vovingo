"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Compass, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="grid-pattern pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-lg flex-col items-center gap-6">
        <span className="grid size-14 place-items-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive shadow-xs">
          <AlertTriangle className="size-6" />
        </span>
        <div>
          <h1 className="text-h1 text-balance">Something went wrong.</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px]/[17px] text-muted-foreground">
            An unexpected error interrupted that page. Your data is unaffected — try again, or
            head back to your dashboard.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-xs text-muted-foreground">Ref: {error.digest}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={reset}>
            <RotateCcw className="size-4" /> Try again
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/" />}>
            <Compass className="size-4" /> Back home
          </Button>
        </div>
      </div>
    </div>
  );
}
