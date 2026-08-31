"use client";

import { useEffect, useState } from "react";
import { Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * The permanent "add this to your phone" link, for the footer.
 *
 * Separate from the install banner on purpose: the banner is rendered once
 * from the root layout, this is rendered inside the site footer, and keeping
 * them in one module meant the same client module was pulled in through two
 * different server layouts.
 *
 * The banner can be dismissed and never comes back, and on plenty of phones
 * Chrome's install event never fires at all — on iOS there is no such event in
 * the first place. So this always shows, and if there is no install prompt to
 * trigger it explains where the button lives instead.
 *
 * It can open a dialog, so it must never be placed inside a <p>: a <div>
 * inside a paragraph is invalid HTML, the parser closes the paragraph early,
 * and hydration then fails for the whole page.
 */

type Prompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallLink({ className }: { className?: string }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as Prompt);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function activate() {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
      return;
    }
    setShowHow(true);
  }

  return (
    <>
      <button type="button" className={className} onClick={activate}>
        <Smartphone
          className="mr-1.5 inline h-3.5 w-3.5 align-text-bottom"
          aria-hidden
        />
        Add to your phone
      </button>

      {showHow && (
        <div
          role="dialog"
          aria-label="How to add Room Within to your phone"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center"
          onClick={() => setShowHow(false)}
        >
          <div
            className="w-full max-w-md rounded-[var(--radius-card)] bg-cream p-6 text-left text-ink shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow !text-[0.6rem] text-bark">
              Add Room Within to your phone
            </p>

            <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink-soft">
              <div>
                <p className="font-medium text-ink">On an iPhone or iPad</p>
                <p className="mt-1">
                  In Safari, tap{" "}
                  <Share
                    className="inline h-3.5 w-3.5 align-text-bottom"
                    aria-hidden
                  />{" "}
                  <strong>Share</strong> at the bottom of the screen, scroll
                  down, and tap <strong>Add to Home Screen</strong>.
                </p>
              </div>

              <div>
                <p className="font-medium text-ink">On an Android phone</p>
                <p className="mt-1">
                  In Chrome, tap the <strong>⋮</strong> menu at the top right,
                  then <strong>Add to Home screen</strong> — or{" "}
                  <strong>Install app</strong>, depending on your version.
                </p>
              </div>

              <div>
                <p className="font-medium text-ink">On a computer</p>
                <p className="mt-1">
                  In Chrome or Edge, look for the small install icon at the
                  right-hand end of the address bar.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Button size="sm" type="button" onClick={() => setShowHow(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
