import type { Metadata } from "next";
import Link from "next/link";
import { requireBooks } from "@/lib/auth";
import { LogoLockup } from "@/components/brand/Logo";

export const metadata: Metadata = {
  title: "The books",
  robots: { index: false, follow: false },
};

/**
 * The accountant's area.
 *
 * Separate from `/admin` on purpose. Everything under `/admin` is guarded by
 * `requireAdmin`, and relaxing that gate to let a second role through would
 * mean every page there had to remember to tighten it again — which is the
 * sort of thing that is remembered on nine pages out of ten.
 *
 * Read-only is enforced twice over: there are no forms here, and the database
 * gives the accountant role SELECT and nothing else. The missing forms stop
 * an honest mistake; the policies stop a crafted request.
 */
export default async function BooksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireBooks();

  return (
    <div className="min-h-dvh bg-parchment">
      <header className="border-b border-tan/30 bg-cream px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/books">
            <LogoLockup />
          </Link>
          <p className="text-xs text-ink-faint">
            {user.fullName ?? user.email} · read-only
          </p>
        </div>
      </header>

      <main className="px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      <p className="px-5 pb-8 text-center text-xs text-ink-faint">
        You can see the figures and download them. Changes are made by Tausha —
        if something needs correcting, tell her rather than working around it.
      </p>
    </div>
  );
}
