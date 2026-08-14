import { cn } from "@/lib/cn";

/** Standard page-width container. */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

/** A vertical band of the page, optionally tinted. */
export function Section({
  className,
  tint,
  children,
  id,
}: {
  className?: string;
  tint?: "cream" | "parchment" | "sage" | "olive";
  children: React.ReactNode;
  id?: string;
}) {
  const tints = {
    cream: "bg-cream",
    parchment: "bg-parchment",
    sage: "bg-sage-pale/45",
    olive: "bg-olive text-cream",
  };
  return (
    <section
      id={id}
      className={cn("py-16 sm:py-24", tint && tints[tint], className)}
    >
      {children}
    </section>
  );
}

/**
 * The poster's section heading treatment: a small-caps eyebrow flanked by
 * hairline rules, then a display heading, then optional lead text.
 */
export function SectionHeading({
  eyebrow,
  title,
  script,
  lead,
  align = "center",
  onDark = false,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  script?: string;
  lead?: string;
  align?: "center" | "left";
  onDark?: boolean;
}) {
  const centered = align === "center";
  return (
    <div className={cn("max-w-2xl", centered && "mx-auto text-center")}>
      {eyebrow && (
        <div
          className={cn(
            "eyebrow flex items-center gap-3",
            centered && "justify-center",
            onDark ? "text-cream/70" : "text-bark",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "h-px w-8",
              onDark ? "bg-cream/35" : "bg-tan/60",
              centered ? "block" : "hidden",
            )}
          />
          {eyebrow}
          <span
            aria-hidden
            className={cn("h-px w-8", onDark ? "bg-cream/35" : "bg-tan/60")}
          />
        </div>
      )}
      <h2
        className={cn(
          "mt-3 text-3xl sm:text-4xl",
          onDark && "text-cream",
        )}
      >
        {title}
        {script && (
          <>
            {" "}
            <span className={cn("script text-4xl sm:text-5xl", onDark && "text-blush")}>
              {script}
            </span>
          </>
        )}
      </h2>
      {lead && (
        <p
          className={cn(
            "mt-4 text-[1.05rem] leading-relaxed",
            onDark ? "text-cream/80" : "text-ink-soft",
          )}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

/** Small burgundy heart — the poster's recurring punctuation mark. */
export function Heart({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("inline-block h-3 w-3 text-burgundy", className)}
    >
      <path d="M12 21s-8.5-5.4-8.5-11A4.7 4.7 0 0 1 12 7.3 4.7 4.7 0 0 1 20.5 10c0 5.6-8.5 11-8.5 11Z" />
    </svg>
  );
}
