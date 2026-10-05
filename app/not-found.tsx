import Link from "next/link";
import { Compass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <div className="grid-pattern pointer-events-none absolute inset-0" aria-hidden />
      <div className="animate-fade-up relative mx-auto flex w-full max-w-lg flex-col items-center gap-6">
        <LogoMark className="size-11 rounded-xl" />
        <p className="text-display text-gradient">404</p>
        <div>
          <h1 className="text-h1 text-balance">That page doesn&apos;t exist</h1>
          <p className="mx-auto mt-3 max-w-md text-[15px]/[17px] text-muted-foreground">
            The link may be out of date, or the lesson moved. Your progress is safe — head back
            and pick up where you left off.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" render={<Link href="/" />}>
            <Compass className="size-4" /> Back home
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/signup" />}>
            <Sparkles className="size-4" /> Start learning free
          </Button>
        </div>
      </div>
    </div>
  );
}
