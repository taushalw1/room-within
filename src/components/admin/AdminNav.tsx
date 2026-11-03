"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { latestUpdate } from "@/content/updates";
import {
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  Home,
  KeyRound,
  NotebookPen,
  Settings,
  Users,
  Wallet,
  Award,
  Coins,
  Flag,
  Wrench,
  GraduationCap,
  Landmark,
  Banknote,
  Plane,
  UserRound,
  Hammer,
  History,
  Sparkles,
} from "lucide-react";
import { LogoLockup } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

const links = [
  { href: "/admin", label: "Dashboard", icon: Home, exact: true },
  { href: "/admin/plan", label: "The plan", icon: Flag },
  { href: "/admin/rentals", label: "Rentals", icon: KeyRound },
  { href: "/admin/maintenance", label: "Repairs", icon: Wrench },
  { href: "/admin/building", label: "The building", icon: Hammer },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/classes", label: "Classes", icon: GraduationCap },
  { href: "/admin/instructors", label: "Instructors", icon: Award },
  { href: "/admin/members", label: "Members", icon: Coins },
  { href: "/admin/events", label: "Events", icon: CalendarPlus },
  { href: "/admin/finance", label: "Finance", icon: Wallet },
  { href: "/admin/bank", label: "The bank", icon: Banknote },
  { href: "/admin/grants", label: "Grants", icon: Landmark },
  { href: "/admin/conferences", label: "Conferences", icon: Plane },
  { href: "/admin/counselling", label: "Counselling", icon: NotebookPen },
  { href: "/admin/contacts", label: "People", icon: Users },
  { href: "/admin/history", label: "Record of changes", icon: History },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/whats-new", label: "What's new", icon: Sparkles, badge: true },
];

export function AdminNav() {
  const pathname = usePathname();
  const [unseen, setUnseen] = useState(false);

  // A quiet dot beside "What's new" when something has shipped since she last
  // looked. In the browser rather than the database: it is a convenience, not
  // a fact worth keeping about somebody, and a new phone showing it once
  // costs nothing.
  useEffect(() => {
    const check = () => {
      try {
        setUnseen(
          window.localStorage.getItem("roomwithin:updates-seen") !== latestUpdate,
        );
      } catch {
        setUnseen(false);
      }
    };

    check();
    window.addEventListener("roomwithin:updates-seen", check);
    return () => window.removeEventListener("roomwithin:updates-seen", check);
  }, []);

  return (
    <nav
      aria-label="Admin"
      className="flex gap-1 overflow-x-auto border-b border-tan/25 bg-parchment px-4 py-2 lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-3 lg:py-5"
    >
      <Link href="/admin" className="mb-1 hidden px-2 py-2 lg:block">
        <LogoLockup className="h-10" />
      </Link>

      {links.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-olive text-cream"
                : "text-ink-soft hover:bg-sage-pale/60 hover:text-olive-deep",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
            {badge && unseen && (
              <span
                className={cn(
                  "ml-auto h-2 w-2 shrink-0 rounded-full",
                  active ? "bg-cream" : "bg-burgundy",
                )}
                aria-label="Something new"
              />
            )}
          </Link>
        );
      })}

      {/* Her own picture and signature live with everyone else's, on the
          account page, rather than being duplicated into the admin area. */}
      <Link
        href="/portal"
        className="mt-auto hidden items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2.5 text-sm text-ink-faint transition-colors hover:text-olive-deep lg:flex"
      >
        <UserRound className="h-4 w-4 shrink-0" aria-hidden />
        Your picture and signature
      </Link>

      <Link
        href="/"
        className="hidden items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2.5 text-sm text-ink-faint transition-colors hover:text-olive-deep lg:flex"
      >
        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
        View public site
      </Link>
    </nav>
  );
}
