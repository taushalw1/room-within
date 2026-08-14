"use client";

import { useState } from "react";
import { money } from "@/lib/format";

/**
 * Twelve months of income against expenses.
 *
 * The two series colours are chart-specific steps of the brand olive and
 * burgundy. They are NOT the raw brand values: those fail the chroma floor and
 * sit outside the readable lightness band. These steps were validated for
 * colour-vision deficiency separation (deutan ΔE 8.5, normal 23.7) and for
 * contrast against the cream surface. If you restyle this chart, re-validate
 * rather than eyeballing it.
 */
const SERIES = [
  { key: "income", label: "Money in", color: "#6F8A30" },
  { key: "expenses", label: "Money out", color: "#AF3F5C" },
] as const;

export type MonthlyPoint = { month: string; income: number; expenses: number };

const W = 720;
const H = 268;
const PAD = { top: 16, right: 12, bottom: 34, left: 56 };

export function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="px-5 py-16 text-center text-sm text-ink-faint">
        No figures yet — this fills in as money comes in and goes out.
      </p>
    );
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const baseline = PAD.top + plotH;

  const rawMax = Math.max(...data.flatMap((d) => [d.income, d.expenses]), 1);
  // Round the top of the scale up to a clean number so the gridlines read well.
  const step = Math.pow(10, Math.floor(Math.log10(rawMax))) / 2;
  const max = Math.ceil(rawMax / step) * step;

  const groupW = plotW / data.length;
  const barW = Math.min(20, (groupW - 10) / 2);
  const gap = 2; // surface gap between adjacent bars, per the mark spec
  const pairW = barW * 2 + gap;

  const y = (v: number) => baseline - (v / max) * plotH;
  const groupX = (i: number) => PAD.left + i * groupW;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  /**
   * Axis labels. Rounding everything to whole thousands collapses distinct
   * gridlines into the same label ("$1k, $1k"), so only abbreviate once the
   * numbers are genuinely large enough for it to read cleanly.
   */
  const tickLabel = (cents: number) => {
    if (cents === 0) return "0";
    if (max >= 2_000_000) return `$${Math.round(cents / 100_000)}k`;
    return `$${Math.round(cents / 100).toLocaleString("en-CA")}`;
  };

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="px-5 py-4">
      {/* Legend — always present for two or more series */}
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-xs text-ink-soft">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ background: s.color }}
            />
            {s.label}
          </li>
        ))}
      </ul>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Money in and money out, by month, over the last twelve months. The full figures are in the table below."
          onMouseLeave={() => setHover(null)}
        >
          {/* Gridlines and value axis — deliberately recessive */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--color-tan)"
                strokeOpacity={t === 0 ? 0.55 : 0.22}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-[var(--color-ink-faint)] text-[11px]"
              >
                {tickLabel(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = groupX(i) + groupW / 2;
            const left = cx - pairW / 2;
            const isHover = hover === i;

            return (
              <g key={`${d.month}-${i}`}>
                {/* Generous hover target across the whole month column */}
                <rect
                  x={groupX(i)}
                  y={PAD.top}
                  width={groupW}
                  height={plotH}
                  fill={isHover ? "var(--color-sage)" : "transparent"}
                  fillOpacity={isHover ? 0.12 : 0}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.month}: in ${money(d.income)}, out ${money(d.expenses)}`}
                  className="cursor-default outline-none"
                />

                {SERIES.map((s, si) => {
                  const v = d[s.key];
                  const h = Math.max(0, baseline - y(v));
                  return (
                    <rect
                      key={s.key}
                      x={left + si * (barW + gap)}
                      y={y(v)}
                      width={barW}
                      height={h}
                      rx={4}
                      fill={s.color}
                      fillOpacity={hover === null || isHover ? 1 : 0.45}
                      className="pointer-events-none transition-opacity"
                    />
                  );
                })}

                <text
                  x={cx}
                  y={H - 12}
                  textAnchor="middle"
                  className="pointer-events-none fill-[var(--color-ink-faint)] text-[11px]"
                >
                  {d.month}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {active && (
          <div
            role="status"
            className="pointer-events-none absolute right-2 top-0 rounded-[var(--radius-card)] border border-tan/40 bg-cream px-3 py-2 text-xs shadow-[var(--shadow-soft)]"
          >
            <p className="eyebrow !text-[0.58rem] text-bark">{active.month}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-1 flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-[2px]"
                  style={{ background: s.color }}
                />
                <span className="text-ink-soft">{s.label}</span>
                <span className="ml-auto pl-3 font-semibold tabular-nums text-ink">
                  {money(active[s.key])}
                </span>
              </p>
            ))}
            <p className="mt-1.5 border-t border-tan/30 pt-1.5 text-ink-soft">
              Net{" "}
              <strong className="tabular-nums text-ink">
                {money(active.income - active.expenses)}
              </strong>
            </p>
          </div>
        )}
      </div>

      {/* Same numbers, readable without seeing the chart */}
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-ink-soft hover:text-olive-deep">
          Show these figures as a table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr>
                <th className="eyebrow border-b border-tan/25 px-3 py-2 text-left !text-[0.58rem] text-bark">
                  Month
                </th>
                <th className="eyebrow border-b border-tan/25 px-3 py-2 text-right !text-[0.58rem] text-bark">
                  In
                </th>
                <th className="eyebrow border-b border-tan/25 px-3 py-2 text-right !text-[0.58rem] text-bark">
                  Out
                </th>
                <th className="eyebrow border-b border-tan/25 px-3 py-2 text-right !text-[0.58rem] text-bark">
                  Net
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={`${d.month}-row-${i}`}>
                  <td className="border-b border-tan/12 px-3 py-2">{d.month}</td>
                  <td className="border-b border-tan/12 px-3 py-2 text-right tabular-nums">
                    {money(d.income)}
                  </td>
                  <td className="border-b border-tan/12 px-3 py-2 text-right tabular-nums">
                    {money(d.expenses)}
                  </td>
                  <td className="border-b border-tan/12 px-3 py-2 text-right font-semibold tabular-nums">
                    {money(d.income - d.expenses)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
