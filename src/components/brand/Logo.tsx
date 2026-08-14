import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

/**
 * The Room Within logo, in the variations supplied by the designer.
 *
 *   <LogoMark />      the house-and-sprout symbol on its own
 *   <LogoStacked />   symbol above the ROOM WITHIN wordmark — the primary lockup
 *   <LogoBadge />     the circular stamp, for tight square spaces
 *   <LogoLockup />    horizontal: symbol, ROOM / within, and the tagline
 *
 * COLOUR. The symbol is terracotta and the wordmark deep olive. On a dark
 * background that pairing has too little contrast, so every variation takes
 * `tone="current"`, which drops the whole thing to `currentColor` — set the
 * text colour on a parent and the logo follows. That's the reversed treatment
 * used in the footer.
 *
 * The supplied artwork has a fine stitched texture along each stroke. That's
 * deliberately not reproduced: at the sizes used here it reads as a broken
 * line rather than as stitching, so the strokes are drawn clean.
 */

type Tone = "brand" | "current";

const MARK_STROKE = 6.5;

/**
 * The symbol's paths, in a 200×200 space, so the standalone mark and the badge
 * can share one definition rather than drifting apart.
 */
function MarkPaths({ tone }: { tone: Tone }) {
  const stroke = tone === "brand" ? "var(--color-terracotta)" : "currentColor";
  return (
    <g
      fill="none"
      stroke={stroke}
      strokeWidth={MARK_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* House — peaked roof, straight sides, deliberately open along the
          bottom so the sprout reads as growing up out of the ground. */}
      <path d="M38 168 V78 L100 20 L162 78 V168" />

      {/* The central shoot: an outlined flame rising from the stem. */}
      <path d="M100 54 C84 78 84 106 100 122 C116 106 116 78 100 54 Z" />

      {/* Stem, running from inside the shoot to the open base. */}
      <path d="M100 92 V168" />

      {/* Two leaves sweeping up and outward from the stem. */}
      <path d="M100 152 C86 150 68 141 57 118 C77 122 94 134 100 152 Z" />
      <path d="M100 152 C114 150 132 141 143 118 C123 122 106 134 100 152 Z" />
    </g>
  );
}

export function LogoMark({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: Tone;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <MarkPaths tone={tone} />
    </svg>
  );
}

/**
 * Primary lockup — symbol above the wordmark.
 */
export function LogoStacked({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: Tone;
}) {
  return (
    <span className={cn("inline-flex flex-col items-center gap-3", className)}>
      <LogoMark tone={tone} className="h-16 w-16" />
      <span
        className={cn(
          "font-display text-[1.35rem] font-medium uppercase leading-none tracking-[0.3em]",
          // The wide tracking adds space after the final letter; pull it back
          // so the wordmark sits optically centred under the symbol.
          "-mr-[0.3em]",
          tone === "brand" && "text-olive-deep",
        )}
      >
        Room Within
      </span>
    </span>
  );
}

/**
 * Circular stamp — ROOM curving over the symbol, WITHIN beneath it.
 */
export function LogoBadge({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: Tone;
}) {
  const textFill = tone === "brand" ? "var(--color-olive-deep)" : "currentColor";
  return (
    <svg
      viewBox="0 0 260 260"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={site.name}
    >
      <defs>
        {/* Left-to-right over the top of the circle. */}
        <path id="rw-badge-top" d="M40 130 A90 90 0 0 1 220 130" fill="none" />
        {/* Left-to-right under the bottom. The sweep flag keeps the letters
            upright rather than hanging inverted. */}
        <path id="rw-badge-bottom" d="M42 142 A88 88 0 0 0 218 142" fill="none" />
      </defs>

      <g
        fill={textFill}
        className="font-display"
        fontSize="34"
        letterSpacing="7"
        style={{ fontWeight: 500 }}
      >
        <text>
          <textPath href="#rw-badge-top" startOffset="50%" textAnchor="middle">
            ROOM
          </textPath>
        </text>
        <text>
          <textPath href="#rw-badge-bottom" startOffset="50%" textAnchor="middle">
            WITHIN
          </textPath>
        </text>
      </g>

      {/* The two full stops either side */}
      <circle cx="26" cy="130" r="4" fill={textFill} />
      <circle cx="234" cy="130" r="4" fill={textFill} />

      {/* Symbol, centred and scaled down to sit inside the ring */}
      <g transform="translate(65 62) scale(0.65)">
        <MarkPaths tone={tone} />
      </g>
    </svg>
  );
}

/**
 * Horizontal lockup — the version with the script "within" and the tagline.
 * `withTagline={false}` gives the compact form used in the site header.
 */
export function LogoLockup({
  className,
  tone = "brand",
  withTagline = false,
  markClassName,
}: {
  className?: string;
  tone?: Tone;
  withTagline?: boolean;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark tone={tone} className={cn("h-10 w-10", markClassName)} />

      <span className="inline-flex flex-col">
        <span
          className={cn(
            "font-display text-[1.05rem] font-medium uppercase leading-none tracking-[0.22em]",
            tone === "brand" && "text-olive-deep",
          )}
        >
          Room
        </span>
        <span
          className={cn(
            "script -mt-0.5 text-[1.35rem] leading-none",
            tone === "brand" ? "text-olive-deep" : "text-current",
          )}
        >
          within
        </span>

        {withTagline && (
          <>
            <span
              aria-hidden
              className={cn(
                "mt-1.5 block h-px w-full",
                tone === "brand" ? "bg-tan/60" : "bg-current opacity-40",
              )}
            />
            <span
              className={cn(
                "eyebrow mt-1.5 !text-[0.5rem] !tracking-[0.16em]",
                tone === "brand" && "text-olive-deep/80",
              )}
            >
              {site.logoTagline}
            </span>
          </>
        )}
      </span>
    </span>
  );
}
