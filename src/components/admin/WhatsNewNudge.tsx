"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { latestUpdate, updates } from "@/content/updates";

/**
 * A quiet line on the dashboard when something has shipped since she last
 * looked.
 *
 * It shows what it is rather than just saying "updates available", because
 * "something changed, go and find out what" is a worse message than no
 * message. It disappears once she has been to the page, and it is never
 * shown twice.
 */
export function WhatsNewNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(
        window.localStorage.getItem("roomwithin:updates-seen") !== latestUpdate,
      );
    } catch {
      setShow(false);
    }
  }, []);

  if (!show) return null;

  const newest = updates.filter((u) => u.date === latestUpdate);
  const titles = newest.slice(0, 3).map((u) => u.title);

  return (
    <Link
      href="/admin/whats-new"
      className="flex items-start gap-3 rounded-[var(--radius-card)] border border-sage/40 bg-sage-pale/50 px-5 py-4 transition hover:bg-sage-pale"
    >
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-olive-deep" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-olive-deep">
          {newest.length === 1
            ? "Something new in the app"
            : `${newest.length} new things in the app`}
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">
          {titles.join(" · ")}
          {newest.length > titles.length && ", and more"}
        </span>
      </span>
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-olive-deep" aria-hidden />
    </Link>
  );
}
