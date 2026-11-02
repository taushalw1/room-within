"use client";

import { useEffect } from "react";
import { latestUpdate } from "@/content/updates";

/**
 * Remembers that she has read this page, so the dot in the menu goes away.
 *
 * Kept in the browser rather than the database on purpose: it is a
 * convenience, not a fact worth storing about somebody, and the worst case —
 * a new phone showing the dot once — costs nothing.
 */
export function MarkUpdatesSeen() {
  useEffect(() => {
    if (!latestUpdate) return;
    try {
      window.localStorage.setItem("roomwithin:updates-seen", latestUpdate);
      // The menu is rendered beside this page and won't re-read storage on
      // its own, so tell it.
      window.dispatchEvent(new Event("roomwithin:updates-seen"));
    } catch {
      // Private browsing, or storage turned off. Nothing here matters enough
      // to complain about.
    }
  }, []);

  return null;
}
