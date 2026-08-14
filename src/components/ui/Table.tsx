import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  /** Set when the card is a link target, e.g. /admin/counselling#requests */
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-[var(--radius-card)] border border-tan/25 bg-cream",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  description,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-tan/20 px-5 py-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-olive-deep">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-ink-soft">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "eyebrow border-b border-tan/25 px-4 py-3 !text-[0.62rem] text-bark",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "border-b border-tan/12 px-4 py-3 align-middle text-ink",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-12 text-center text-sm text-ink-faint"
      >
        {children}
      </td>
    </tr>
  );
}

type BadgeTone = "neutral" | "good" | "warn" | "bad" | "info";

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-linen text-ink-soft",
    good: "bg-sage-pale text-olive-deep",
    warn: "bg-[#F6E9CF] text-bark",
    bad: "bg-blush text-burgundy",
    info: "bg-[#E2E8EC] text-[#41525C]",
  };
  return (
    <span
      className={cn(
        "eyebrow inline-flex items-center justify-center rounded-full px-2.5 py-1 !text-[0.58rem]",
        // `self-center` matters: as a direct child of a flex row the badge
        // would otherwise stretch to the full row height, leaving the text
        // stranded near the top of a too-tall oval.
        "self-center",
        // The eyebrow style sets a 1.4 line-height for running labels. Inside
        // a pill that adds dead space below the caps, pushing them upward, so
        // the line box is tightened to the glyphs here.
        "!leading-none",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
