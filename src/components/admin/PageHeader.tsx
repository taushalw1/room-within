import { cn } from "@/lib/cn";

/**
 * The heading at the top of an admin page.
 *
 * Painted olive, like the banner on the poster and the public site, so that
 * arriving at a page tells you immediately which one you're on. Before this,
 * every admin page opened with black text on cream and they were hard to tell
 * apart at a glance.
 *
 * The eyebrow is the small letterspaced label used throughout the brand; the
 * title is the same Cormorant as the public headings.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** A button or two, sitting to the right on wide screens. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "rounded-[var(--radius-card)] bg-olive px-6 py-6 text-cream sm:px-8 sm:py-7",
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="eyebrow !text-[0.62rem] text-cream/70">{eyebrow}</p>
          )}
          <h1
            className={cn(
              "font-display text-3xl font-semibold text-cream",
              eyebrow && "mt-1.5",
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream/80">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}
