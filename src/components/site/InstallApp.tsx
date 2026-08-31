"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Registers the service worker, and offers once to add the site to the home
 * screen.
 *
 * Chrome fires `beforeinstallprompt` only after the site passes its
 * installability checks — which include having a registered service worker —
 * so the event always arrives well after this has mounted and is listening.
 *
 * iOS fires nothing at all and gives no way to trigger the flow, so there the
 * only honest thing is to say where the button is. The permanent link in the
 * footer (InstallLink) covers every other case, including the phones where
 * the event never arrives.
 *
 * The banner appears once and is dismissed for good — nobody should have to
 * refuse the same suggestion twice.
 */

const DISMISSED = "roomwithin.install.dismissed";

type Prompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallApp() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  // Registering the worker is what makes the site installable at all, and what
  // lets it open with no signal.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Losing offline support is a small thing, and never worth breaking
        // the page over.
      });
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED)) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    setDismissed(false);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as Prompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // No event is coming on iOS, so decide from the browser itself.
    const ua = navigator.userAgent;
    const isIos =
      /iphone|ipad|ipod/i.test(ua) ||
      // iPads report as desktop Safari, so fall back to the touch test.
      (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|android/i.test(ua);
    if (isIos && isSafari) setShowIos(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED, "1");
    setDismissed(true);
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    dismiss();
  }

  // Nothing to offer until either the event arrives or we know it is iOS.
  if (dismissed || (!prompt && !showIos)) return null;

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

        {prompt ? (
          <>
            <p className="mt-2 pr-4 text-sm leading-relaxed text-ink-soft">
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
        ) : (
          <>
            <p className="mt-2 pr-4 text-sm leading-relaxed text-ink-soft">
              Add Room Within to your home screen and it opens like an app. Tap{" "}
              <Share
                className="inline h-3.5 w-3.5 align-text-bottom"
                aria-hidden
              />{" "}
              <strong>Share</strong> at the bottom of Safari, then{" "}
              <strong>Add to Home Screen</strong>.
            </p>
            <div className="mt-4">
              <Button
                size="sm"
                variant="secondary"
                type="button"
                onClick={dismiss}
              >
                Got it
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
