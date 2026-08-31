"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Registers the service worker, and offers to put the site on the home screen.
 *
 * Two quite different things happen here depending on the phone:
 *
 *   - Android and desktop Chrome fire `beforeinstallprompt`, which gives us a
 *     real install button we can trigger.
 *   - iOS fires nothing at all and has no install API. The only way is Share →
 *     Add to Home Screen, so on iOS we can only show the instruction. Saying
 *     it plainly beats a button that does nothing.
 *
 * Either way, the banner appears once and is dismissed for good. Nobody should
 * have to refuse the same suggestion twice.
 */

const DISMISSED = "roomwithin.install.dismissed";

type Prompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallApp() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Not being able to work offline is a small loss, and never a reason
        // to break the page.
      });
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED)) return;

    // Already installed — nothing to offer.
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (installed) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as Prompt);
      setHidden(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS: no event is coming, so decide from the browser itself.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari =
      /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

    if (isIos && isSafari) {
      setShowIosHint(true);
      setHidden(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED, "1");
    setHidden(true);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    dismiss();
  }

  if (hidden) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-4 sm:w-[22rem]">
      <div className="relative rounded-[var(--radius-card)] border border-tan/40 bg-cream p-5 shadow-lg">
        <button
          type="button"
          onClick={dismiss}
          aria-label="No thanks"
          className="absolute right-3 top-3 text-ink-faint transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <p className="eyebrow !text-[0.6rem] text-bark">Keep us handy</p>

        {showIosHint ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Add Room Within to your home screen and it opens like an app.
              Tap{" "}
              <Share className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden />{" "}
              <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
            </p>
            <div className="mt-4">
              <Button size="sm" variant="secondary" type="button" onClick={dismiss}>
                Got it
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Put Room Within on your home screen. It opens like an app, and
              what&rsquo;s on still works without a signal.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" type="button" onClick={install}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                Add to home screen
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
