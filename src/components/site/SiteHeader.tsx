"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { LogoInline } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";
import { nav } from "@/lib/site";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-tan/25 bg-cream/92 backdrop-blur-sm">
      <Container className="flex h-[70px] items-center justify-between gap-4">
        <Link
          href="/"
          className="text-olive-deep transition-opacity hover:opacity-75"
          aria-label={`${"Room Within Community"} — home`}
        >
          <LogoInline />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded px-3 py-2 text-sm transition-colors",
                  active
                    ? "text-burgundy"
                    : "text-ink-soft hover:text-olive-deep",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ButtonLink href="/login" variant="secondary" size="sm">
            Sign in
          </ButtonLink>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded p-2 text-olive-deep lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </Container>

      {/* Mobile nav */}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-tan/25 bg-cream lg:hidden"
        >
          <Container className="flex flex-col py-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-tan/15 py-3 text-ink-soft last:border-0"
              >
                {item.label}
              </Link>
            ))}
            <ButtonLink
              href="/login"
              variant="secondary"
              size="sm"
              className="mt-4 self-start"
              onClick={() => setOpen(false)}
            >
              Sign in
            </ButtonLink>
          </Container>
        </nav>
      )}
    </header>
  );
}
