import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A single headline figure on the admin dashboard.
 * `tone="bad"` is for money that's late — the one number that should catch
 * the eye before any other.
 */
export function Stat({
  label,
  value,
  sub,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  href?: string;
  tone?: "default" | "good" | "bad";
}) {
  const body = (
    <div
      className={cn(
        "h-full overflow-hidden rounded-[var(--radius-card)] border p-5 transition-colors",
        // A stripe of colour down the left edge. Four of these sit in a row and
        // on plain cream they read as one block — the stripe separates them
        // and carries the tone without shouting.
        "border-l-4",
        tone === "bad"
          ? "border-burgundy/30 border-l-burgundy bg-blush/40"
          : tone === "good"
            ? "border-sage/30 border-l-olive bg-sage-pale/35"
            : "border-tan/25 border-l-sage bg-cream",
        href && "hover:border-olive/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow !text-[0.62rem] text-bark">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              tone === "bad"
                ? "bg-burgundy/12 text-burgundy"
                : tone === "good"
                  ? "bg-olive/12 text-olive-deep"
                  : "bg-sage-pale/70 text-olive",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-3 font-display text-3xl font-semibold tabular-nums",
          tone === "bad" ? "text-burgundy" : "text-olive-deep",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
