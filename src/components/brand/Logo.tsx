import Image from "next/image";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

/**
 * The Room Within logo.
 *
 * These are the supplied artwork files, not redrawn versions — an earlier
 * attempt to rebuild the symbol in SVG got the details wrong. The assets are
 * cut out of the designer's source sheet by `scripts/build-brand-assets.mjs`;
 * re-run that if the artwork is ever reissued.
 *
 *   <LogoMark />      the house-and-sprout symbol on its own
 *   <LogoStacked />   symbol above the ROOM WITHIN wordmark — the primary lockup
 *   <LogoBadge />     the circular stamp
 *   <LogoLockup />    horizontal, with or without the tagline
 *
 * The cream background has been converted to transparency, so these sit
 * correctly on both the cream and parchment sections.
 *
 * ON DARK BACKGROUNDS: don't. The wordmark is deep olive, which disappears
 * against the olive footer, and raster artwork can't be recoloured the way the
 * old SVG could. Use <LogoTile>, which sets the logo on a cream panel.
 */

/** Intrinsic pixel sizes, so next/image can reserve the right space. */
const ASSETS = {
  mark: { src: "/logo-mark.png", width: 370, height: 340 },
  stacked: { src: "/logo-stacked.png", width: 867, height: 427 },
  badge: { src: "/logo-badge.png", width: 301, height: 355 },
  lockup: { src: "/logo-lockup.png", width: 522, height: 284 },
  lockupCompact: { src: "/logo-lockup-compact.png", width: 522, height: 228 },
} as const;

type Variant = keyof typeof ASSETS;

function LogoImage({
  variant,
  className,
  priority,
  decorative,
  sizedBy = "height",
}: {
  variant: Variant;
  className?: string;
  priority?: boolean;
  /** True where a nearby label already names the logo, e.g. the header link. */
  decorative?: boolean;
  /**
   * Which axis the caller's classes set. next/image needs the other axis left
   * explicitly `auto`, or it warns that the aspect ratio may be distorted —
   * and an inline `height: auto` would override a Tailwind `h-*` class.
   */
  sizedBy?: "height" | "width";
}) {
  const asset = ASSETS[variant];
  return (
    <Image
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={decorative ? "" : site.name}
      aria-hidden={decorative || undefined}
      priority={priority}
      className={cn("object-contain", className)}
      style={sizedBy === "height" ? { width: "auto" } : { height: "auto" }}
    />
  );
}

export function LogoMark(props: Omit<Parameters<typeof LogoImage>[0], "variant">) {
  return <LogoImage variant="mark" {...props} />;
}

export function LogoStacked(props: Omit<Parameters<typeof LogoImage>[0], "variant">) {
  return <LogoImage variant="stacked" {...props} />;
}

export function LogoBadge(props: Omit<Parameters<typeof LogoImage>[0], "variant">) {
  return <LogoImage variant="badge" {...props} />;
}

export function LogoLockup({
  withTagline = false,
  ...props
}: Omit<Parameters<typeof LogoImage>[0], "variant"> & { withTagline?: boolean }) {
  return (
    <LogoImage variant={withTagline ? "lockup" : "lockupCompact"} {...props} />
  );
}

/**
 * The logo on a cream panel, for placing on the olive footer or any other dark
 * surface where the olive wordmark would otherwise vanish.
 */
export function LogoTile({
  className,
  variant = "stacked",
}: {
  className?: string;
  variant?: "stacked" | "badge" | "lockup";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-card)] bg-cream px-5 py-4",
        className,
      )}
    >
      {/* An explicit width, not `w-full`: the tile is inline-flex, so it sizes
          to its content — a percentage width inside it resolves to zero. */}
      <LogoImage variant={variant} sizedBy="width" className="w-[190px]" />
    </span>
  );
}
