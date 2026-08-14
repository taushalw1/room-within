import { cn } from "@/lib/cn";

/**
 * The berry-and-leaf branch that frames the poster. Purely decorative —
 * hidden from screen readers, and kept low-contrast so text stays readable
 * on top of it.
 */
export function Botanical({
  className,
  flip = false,
}: {
  className?: string;
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 240 320"
      fill="none"
      aria-hidden="true"
      className={cn("pointer-events-none select-none", flip && "-scale-x-100", className)}
    >
      {/* Main stem */}
      <path
        d="M18 8 C60 60 92 128 108 200 C118 246 122 284 120 314"
        stroke="var(--color-sage)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* Side stems */}
      <path
        d="M62 66 C88 78 104 100 112 126 M92 132 C124 138 146 156 158 182 M108 200 C142 202 168 218 182 244"
        stroke="var(--color-sage)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />

      {/* Leaves, scattered along the stems */}
      {[
        { x: 46, y: 44, r: -28 },
        { x: 78, y: 92, r: 12 },
        { x: 108, y: 118, r: -40 },
        { x: 130, y: 150, r: 22 },
        { x: 96, y: 176, r: -18 },
        { x: 160, y: 196, r: 34 },
        { x: 122, y: 232, r: -12 },
        { x: 176, y: 250, r: 26 },
        { x: 100, y: 272, r: -34 },
        { x: 142, y: 296, r: 8 },
      ].map((leaf, i) => (
        <g key={i} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r})`}>
          <path
            d="M0 0 C16 -4 30 4 34 18 C18 24 4 16 0 0 Z"
            fill="var(--color-sage)"
            opacity={i % 2 === 0 ? 0.4 : 0.28}
          />
          <path
            d="M0 0 C12 3 24 10 34 18"
            stroke="var(--color-olive)"
            strokeWidth="1"
            opacity="0.25"
          />
        </g>
      ))}

      {/* Berries */}
      {[
        { x: 34, y: 22, r: 7 },
        { x: 50, y: 16, r: 5 },
        { x: 24, y: 40, r: 6 },
        { x: 150, y: 172, r: 6 },
        { x: 164, y: 166, r: 4.5 },
        { x: 190, y: 236, r: 6.5 },
        { x: 202, y: 248, r: 5 },
        { x: 86, y: 256, r: 5.5 },
      ].map((b, i) => (
        <circle
          key={i}
          cx={b.x}
          cy={b.y}
          r={b.r}
          fill="var(--color-burgundy)"
          opacity="0.28"
        />
      ))}
    </svg>
  );
}

/** A slim leafy divider — the poster's "🌿 heading 🌿" flourish. */
export function LeafDivider({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 20"
      fill="none"
      aria-hidden="true"
      className={cn("h-4 w-[120px]", className)}
    >
      <path
        d="M4 10 H116"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.4"
        strokeLinecap="round"
      />
      {[30, 48, 66, 84].map((x, i) => (
        <path
          key={x}
          d="M0 0 C7 -2 13 2 15 8 C8 10 2 6 0 0 Z"
          fill="currentColor"
          opacity={0.5 - i * 0.06}
          transform={`translate(${x} 6) rotate(${i % 2 === 0 ? -14 : 14})`}
        />
      ))}
    </svg>
  );
}
