import { clsx } from "clsx";

/**
 * The Room Within mark: a house outline with a sprout growing inside it.
 * Drawn in `currentColor` so it inherits whatever text colour it sits in —
 * olive on cream in the header, cream on olive in the footer.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={clsx("shrink-0", className)}
    >
      {/* House */}
      <path
        d="M50 9 L89 40.5 V86 a5 5 0 0 1-5 5 H16 a5 5 0 0 1-5-5 V40.5 Z"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      {/* Stem */}
      <path
        d="M50 79 V45"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Left leaf */}
      <path
        d="M50 66 C39 66 31.5 58 31.5 47.5 C42.5 47.5 50 55.5 50 66 Z"
        fill="currentColor"
      />
      {/* Right leaf */}
      <path
        d="M50 57 C61 57 68.5 49 68.5 38.5 C57.5 38.5 50 46.5 50 57 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Full lockup — mark above the letterspaced wordmark, as on the poster.
 */
export function Logo({
  className,
  markClassName,
  showCommunity = true,
}: {
  className?: string;
  markClassName?: string;
  showCommunity?: boolean;
}) {
  return (
    <span className={clsx("inline-flex flex-col items-center", className)}>
      <LogoMark className={clsx("h-10 w-10", markClassName)} />
      <span className="eyebrow mt-1.5 flex flex-col items-center leading-[1.15]">
        <span>Room</span>
        <span>Within</span>
        {showCommunity && (
          <span className="mt-0.5 text-[0.6em] tracking-[0.22em] opacity-80">
            Community
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * Horizontal variant for tight spaces (mobile header, emails, admin sidebar).
 */
export function LogoInline({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-8" />
      <span className="eyebrow text-[0.8rem] leading-tight">
        Room Within
        <span className="block text-[0.72em] tracking-[0.2em] opacity-75">
          Community
        </span>
      </span>
    </span>
  );
}
