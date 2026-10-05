import Link from "next/link";
import { AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)] text-white shadow-sm",
        className
      )}
      aria-hidden
    >
      <AudioLines className="size-4.5" />
    </span>
  );
}

export function Logo({
  href = "/dashboard",
  className,
  markClassName,
}: {
  href?: string;
  className?: string;
  markClassName?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-heading font-semibold tracking-tight", className)}
    >
      <LogoMark className={markClassName} />
      <span className="text-[15px]">Vovingo</span>
    </Link>
  );
}
