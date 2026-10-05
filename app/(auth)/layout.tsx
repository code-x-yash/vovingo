import { Mic, ScanSearch, TrendingUp } from "lucide-react";
import { Logo } from "@/components/logo";

const VALUES = [
  {
    icon: Mic,
    title: "Speak every day",
    body: "Five-minute takes, scored the moment you stop talking.",
  },
  {
    icon: ScanSearch,
    title: "Find your patterns",
    body: "Forty-five rules watch for the mistakes you repeat.",
  },
  {
    icon: TrendingUp,
    title: "Watch it move",
    body: "Skill scores and a weekly report, in plain English.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:grid lg:grid-cols-2">
      <div className="relative overflow-hidden border-b border-border/60 bg-muted/40 px-5 py-8 sm:px-8 lg:border-r lg:border-b-0 lg:px-12 lg:py-10">
        <div className="grid-pattern pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex flex-col justify-between gap-10 lg:h-full">
          <Logo href="/" markClassName="size-10 rounded-xl" />
          <div className="max-w-md space-y-4">
            <p className="text-h1 text-balance">Learn English by speaking.</p>
            <p className="text-[15px]/[17px] text-muted-foreground">
              Vovingo listens to what you actually say, finds the rules you keep breaking, and
              turns them into a short daily plan you can finish.
            </p>
            <ul className="hidden gap-3 lg:grid lg:grid-cols-1">
              {VALUES.map((v) => {
                const Icon = v.icon;
                return (
                  <li key={v.title} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-primary shadow-xs">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{v.title}</span>
                      <span className="block text-xs text-muted-foreground">{v.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="hidden text-xs text-muted-foreground lg:block">© 2026 Vovingo</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
