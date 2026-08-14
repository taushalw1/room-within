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
        "h-full rounded-[var(--radius-card)] border p-5 transition-colors",
        tone === "bad"
          ? "border-burgundy/30 bg-blush/40"
          : "border-tan/25 bg-cream",
        href && "hover:border-olive/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow !text-[0.62rem] text-bark">{label}</p>
        {Icon && (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              tone === "bad" ? "text-burgundy" : "text-sage",
            )}
            aria-hidden
          />
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
