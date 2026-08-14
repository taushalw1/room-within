import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-display font-semibold uppercase " +
  "tracking-[0.14em] transition-colors duration-150 rounded-[var(--radius-card)] " +
  "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-olive text-cream hover:bg-olive-deep",
  secondary:
    "border border-olive/35 text-olive-deep bg-transparent hover:bg-sage-pale/60",
  ghost: "text-olive-deep hover:bg-sage-pale/50",
  danger: "bg-burgundy text-cream hover:bg-berry",
};

const sizes: Record<Size, string> = {
  sm: "text-[0.7rem] px-3.5 py-2",
  md: "text-xs px-5 py-2.5",
  lg: "text-sm px-7 py-3.5",
};

type CommonProps = { variant?: Variant; size?: Size; className?: string };

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: CommonProps & React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
