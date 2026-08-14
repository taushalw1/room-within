"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Share an event to WhatsApp.
 *
 * This deliberately uses WhatsApp's share link rather than the Business API.
 * The API cannot post into ordinary WhatsApp groups at all — it only messages
 * individuals who have opted in, and needs Meta business verification plus
 * approved message templates. A share link opens WhatsApp with the message
 * already written, and Tausha picks the group. One tap, no approvals, and it
 * reaches the groups the community actually uses.
 */
export function ShareEvent({
  title,
  when,
  location,
  url,
}: {
  title: string;
  when: string;
  location?: string | null;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  const message = [
    `📅 ${title}`,
    when,
    location ? `📍 ${location}` : null,
    "",
    url,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-card)] border border-olive/30 px-3 py-1.5 text-xs text-olive-deep transition-colors hover:bg-sage-pale/60"
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        Share to WhatsApp
      </a>

      <button
        type="button"
        onClick={copyMessage}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-card)] px-3 py-1.5 text-xs text-ink-soft transition-colors hover:bg-sage-pale/50 hover:text-olive-deep"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-olive" aria-hidden />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy message
          </>
        )}
      </button>

      {typeof navigator !== "undefined" && "share" in navigator && (
        <button
          type="button"
          onClick={() => navigator.share({ title, text: message, url })}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-card)] px-3 py-1.5 text-xs text-ink-soft transition-colors hover:bg-sage-pale/50 hover:text-olive-deep"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden />
          More
        </button>
      )}
    </div>
  );
}
