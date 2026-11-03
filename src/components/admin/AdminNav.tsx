"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, UserRound } from "lucide-react";
import { latestUpdate } from "@/content/updates";
import { LogoLockup } from "@/components/brand/Logo";
import { asides, isActive, sectionFor, sections } from "@/lib/admin-nav";
import { cn } from "@/lib/cn";

/**
 * The admin menu: eight sections, not twenty links.
 *
 * Twenty items made a bar you had to scroll sideways to read, so the thing
 * you wanted was often past the edge of the screen. Related pages are grouped
 * now, and the pages inside a section appear as a second row once you are in
 * it — see `SectionTabs`. Nothing was removed; the daily things are still one
 * click away and the yearly things are two.
 *
 * The dot for something new sits on Settings as well as on What's new itself,
 * because a notice you can only see once you have gone looking for it is not
 * a notice.
 */
/**
 * Bring the current item into view in a bar that scrolls sideways.
 *
 * On a narrow screen the menu is wider than the screen, so landing on a page
 * whose menu entry is near the end means arriving with nothing highlighted
 * and no clue that scrolling would help. The container's own `scrollLeft` is
 * set rather than calling `scrollIntoView`, which also scrolls every
 * ancestor and would jump the page itself.
 */
function useScrollActiveIntoView(pathname: string) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const active = container.querySelector<HTMLElement>("[aria-current]");
    if (!active) return;

    // Only when it is genuinely out of view; otherwise this nudges the bar
    // on every navigation for no reason.
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;

    if (left < viewLeft || right > viewRight) {
      container.scrollLeft = left - (container.clientWidth - active.offsetWidth) / 2;
    }
  }, [pathname]);

  return ref;
}

export function AdminNav() {
  const pathname = usePathname();
  const [unseen, setUnseen] = useState(false);

  // In the browser rather than the database: it is a convenience, not a fact
  // worth keeping about somebody, and a new phone showing it once costs
  // nothing.
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

  const current = sectionFor(pathname);
  const ref = useScrollActiveIntoView(pathname);

  return (
    <nav
      ref={ref as React.RefObject<HTMLElement>}
      aria-label="Admin"
      className="flex gap-1 overflow-x-auto border-b border-tan/25 bg-parchment px-4 py-2 lg:h-dvh lg:w-56 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-3 lg:py-5"
    >
      <Link href="/admin" className="mb-1 hidden px-2 py-2 lg:block">
        <LogoLockup className="h-10" />
      </Link>

      {sections.map((section) => {
        const Icon = section.icon;
        // A section is lit by any of its pages, not only its own landing one.
        const active = current?.href === section.href;

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-olive text-cream"
                : "text-ink-soft hover:bg-sage-pale/60 hover:text-olive-deep",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {section.label}
            {section.badge && unseen && (
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

      <div className="mt-auto hidden lg:block">
        {asides.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2.5 text-sm text-ink-faint transition-colors hover:text-olive-deep"
          >
            {href === "/" ? (
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <UserRound className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/**
 * The pages inside whichever section you are in.
 *
 * Rendered above the page rather than nested in the menu, so it reads as
 * "where you are" instead of adding depth to a list that was already too
 * long. A section with nothing inside it — the dashboard — shows nothing at
 * all rather than an empty strip.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const [unseen, setUnseen] = useState(false);

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

  const section = sectionFor(pathname);
  const ref = useScrollActiveIntoView(pathname);

  if (!section?.children || section.children.length < 2) return null;

  return (
    <div className="border-b border-tan/25 bg-cream">
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 py-2 sm:px-8 lg:px-10"
      >
        {section.children.map((child) => {
          const active = isActive(child, pathname);
          return (
            <Link
              key={child.href}
              href={child.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-sage-pale font-semibold text-olive-deep"
                  : "text-ink-soft hover:bg-linen hover:text-olive-deep",
              )}
            >
              {child.label}
              {child.badge && unseen && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-burgundy"
                  aria-label="Something new"
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
