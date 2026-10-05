import {
  BookOpen,
  Headphones,
  Home,
  Languages,
  Mic,
  PenLine,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Home", icon: Home },
      { href: "/lessons", label: "Learn", icon: BookOpen },
      { href: "/speaking", label: "Speak", icon: Mic },
      { href: "/listening", label: "Listen", icon: Headphones },
    ],
  },
  {
    label: "Practice",
    items: [
      { href: "/vocab", label: "Vocabulary", icon: Languages },
      { href: "/writing", label: "Writing", icon: PenLine },
      { href: "/mistakes", label: "Mistakes", icon: Target },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/progress", label: "Progress", icon: TrendingUp },
      { href: "/conversation", label: "AI Coach", icon: Sparkles },
    ],
  },
];

export const MOBILE_NAV: NavItem[] = [
  NAV_GROUPS[0].items[0],
  NAV_GROUPS[0].items[1],
  NAV_GROUPS[0].items[2],
  NAV_GROUPS[0].items[3],
  NAV_GROUPS[2].items[0],
];

const PAGE_TITLES: [string, string][] = [
  ["/dashboard", "Home"],
  ["/lessons", "Learn"],
  ["/speaking", "Speak"],
  ["/listening", "Listen"],
  ["/writing", "Writing"],
  ["/vocab", "Vocabulary"],
  ["/mistakes", "Mistakes"],
  ["/progress", "Progress"],
  ["/conversation", "AI Coach"],
];

export function pageTitle(pathname: string): string {
  const match = PAGE_TITLES.filter(([prefix]) => pathname.startsWith(prefix)).sort(
    (a, b) => b[0].length - a[0].length
  )[0];
  return match?.[1] ?? "Vovingo";
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
