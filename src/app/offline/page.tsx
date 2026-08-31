import type { Metadata } from "next";
import { CloudOff } from "lucide-react";
import { Container, Section } from "@/components/ui/Section";
import { LogoStacked } from "@/components/brand/Logo";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "No connection",
  robots: { index: false, follow: false },
};

/**
 * Shown by the service worker when a page is asked for with no connection and
 * nothing useful in the cache.
 *
 * It carries the address and an email rather than only an apology — somebody
 * with no signal is often somebody trying to find the building.
 */
export default function OfflinePage() {
  return (
    <Section tint="parchment" className="py-24">
      <Container className="max-w-lg text-center">
        <LogoStacked className="mx-auto w-40" />

        <CloudOff className="mx-auto mt-10 h-8 w-8 text-olive" aria-hidden />

        <h1 className="mt-5 text-3xl">You&rsquo;re offline</h1>

        <p className="mt-4 leading-relaxed text-ink-soft">
          This page needs a connection and there isn&rsquo;t one at the moment.
          Anything you looked at earlier should still open.
        </p>

        <p className="mt-8 text-sm text-ink-soft">
          If you need us,{" "}
          <a href={`mailto:${site.email}`} className="underline">
            {site.email}
          </a>
          .
        </p>

        <p className="mt-2 text-sm text-ink-faint">{site.address.oneLine}</p>
      </Container>
    </Section>
  );
}
