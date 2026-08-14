import { cn } from "@/lib/cn";

/**
 * Line drawing of the 1905 building — a stand-in for the hero photograph.
 *
 * TO USE THE REAL PHOTO INSTEAD: drop the image at `public/building.jpg`, then
 * ask Claude to "use the real building photo on the home page". It will swap
 * this component for a next/image and keep the same frame and rounding.
 */
export function BuildingIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 380"
      fill="none"
      role="img"
      aria-label="Line illustration of the historic 1905 Room Within building on the main street of Grassy Lake"
      className={cn("h-full w-full", className)}
    >
      <defs>
        <linearGradient id="rw-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-sage-pale)" stopOpacity="0.7" />
          <stop offset="100%" stopColor="var(--color-cream)" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <rect width="520" height="380" fill="url(#rw-sky)" />

      <g
        stroke="var(--color-olive-deep)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Roof / cornice */}
        <path d="M60 96 H430 L452 118 H82 Z" fill="var(--color-bark)" fillOpacity="0.16" />
        <path d="M82 118 H452" />

        {/* Main facade */}
        <path d="M82 118 V330 H452 V118" fill="var(--color-cream)" fillOpacity="0.75" />

        {/* Upper storey windows with flower boxes */}
        {[110, 178, 246, 314, 382].map((x) => (
          <g key={x}>
            <rect
              x={x}
              y={140}
              width="42"
              height="58"
              rx="2"
              fill="var(--color-olive)"
              fillOpacity="0.16"
            />
            <path d={`M${x + 21} 140 V198`} strokeWidth="1.2" opacity="0.6" />
            <path d={`M${x} 169 H${x + 42}`} strokeWidth="1.2" opacity="0.6" />
            {/* Flower box */}
            <path
              d={`M${x - 4} 198 H${x + 46} L${x + 42} 210 H${x} Z`}
              fill="var(--color-bark)"
              fillOpacity="0.3"
            />
            {/* Trailing greenery */}
            <path
              d={`M${x + 4} 210 q4 12 -2 20 M${x + 20} 210 q-3 14 3 22 M${x + 36} 210 q5 11 -1 18`}
              stroke="var(--color-sage)"
              strokeWidth="2"
              opacity="0.85"
            />
          </g>
        ))}

        {/* Awning over the storefronts */}
        <path
          d="M82 236 H452 L440 258 H94 Z"
          fill="var(--color-olive)"
          fillOpacity="0.5"
        />

        {/* Storefront bays: CAFE · OFFICES · DAYCARE */}
        {[104, 232, 360].map((x) => (
          <g key={x}>
            <rect
              x={x}
              y={264}
              width="88"
              height="66"
              rx="2"
              fill="var(--color-olive)"
              fillOpacity="0.13"
            />
            <path d={`M${x + 44} 264 V330`} strokeWidth="1.2" opacity="0.5" />
          </g>
        ))}

        {/* Potted trees along the sidewalk */}
        {[92, 208, 336, 444].map((x) => (
          <g key={x}>
            <path
              d={`M${x - 9} 312 h18 l-3 18 h-12 Z`}
              fill="var(--color-bark)"
              fillOpacity="0.35"
            />
            <path d={`M${x} 312 V292`} strokeWidth="1.6" />
            <path
              d={`M${x} 296 q-13 -5 -15 -20 q14 1 15 20 Z M${x} 290 q13 -5 15 -20 q-14 1 -15 20 Z`}
              fill="var(--color-sage)"
              fillOpacity="0.6"
              strokeWidth="1.2"
            />
          </g>
        ))}

        {/* Exterior staircase to the suites */}
        <path d="M452 330 V150 H500 V330" fill="var(--color-cream)" fillOpacity="0.6" />
        <path
          d="M452 322 L500 322 M456 306 L500 306 M462 290 L500 290 M470 274 L500 274 M480 258 L500 258 M490 242 L500 242"
          strokeWidth="1.6"
          opacity="0.75"
        />
        <path d="M452 210 H500" strokeWidth="1.6" opacity="0.5" />

        {/* Sidewalk */}
        <path d="M20 330 H500" strokeWidth="2.5" />
        <path d="M20 348 H500" strokeWidth="1" opacity="0.35" />
      </g>

      {/* Hanging sign */}
      <g>
        <path
          d="M370 130 h72 v46 h-72 Z"
          fill="var(--color-cream)"
          stroke="var(--color-olive-deep)"
          strokeWidth="1.6"
        />
        <text
          x="406"
          y="150"
          textAnchor="middle"
          fill="var(--color-olive-deep)"
          fontSize="11"
          fontFamily="var(--font-display)"
          letterSpacing="1.5"
        >
          ROOM
        </text>
        <text
          x="406"
          y="165"
          textAnchor="middle"
          fill="var(--color-olive-deep)"
          fontSize="11"
          fontFamily="var(--font-display)"
          letterSpacing="1.5"
        >
          WITHIN
        </text>
      </g>
    </svg>
  );
}
