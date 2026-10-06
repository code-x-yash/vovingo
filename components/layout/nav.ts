import {
  BookOpen,
  Drama,
  Feather,
  Headphones,
  Home,
  Languages,
  Laugh,
  Mic,
  PartyPopper,
  PenLine,
  Phone,
  ScrollText,
  Settings,
  Sparkles,
  Swords,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Waves,
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
      { href: "/speedrun", label: "Speedrun", icon: Timer },
      { href: "/phantom", label: "Phantom call", icon: Phone },
      { href: "/bloopers", label: "Bloopers", icon: Laugh },
      { href: "/scripts", label: "Scripts", icon: ScrollText },
      { href: "/tone", label: "Tone lab", icon: Waves },
      { href: "/duel", label: "Rap duel", icon: Swords },
      { href: "/story", label: "Co-op story", icon: Feather },
      { href: "/stage", label: "Stage mode", icon: Drama },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/progress", label: "Progress", icon: TrendingUp },
      { href: "/conversation", label: "AI Coach", icon: Sparkles },
      { href: "/leaderboard", label: "Leagues", icon: Trophy },
      { href: "/wrapped", label: "Wrapped", icon: PartyPopper },
      { href: "/settings", label: "Settings", icon: Settings },
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
  ["/speedrun", "Speedrun"],
  ["/phantom", "Phantom call"],
  ["/bloopers", "Bloopers"],
  ["/scripts", "Scripts"],
  ["/tone", "Tone lab"],
  ["/duel", "Rap duel"],
  ["/story", "Co-op story"],
  ["/stage", "Stage mode"],
  ["/progress", "Progress"],
  ["/conversation", "AI Coach"],
  ["/leaderboard", "Leagues"],
  ["/wrapped", "Wrapped"],
  ["/settings", "Settings"],
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
