import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./button";

export function AppCard({
  className,
  tier = "secondary",
  interactive = false,
  ...props
}: HTMLAttributes<HTMLElement> & {
  tier?: "primary" | "secondary" | "tertiary";
  interactive?: boolean;
}) {
  return (
    <section
      className={cn(
        "border border-border bg-card text-card-foreground",
        tier === "primary" && "rounded-2xl shadow-card",
        tier === "secondary" && "rounded-xl shadow-card",
        tier === "tertiary" && "rounded-lg bg-muted/25 shadow-none",
        interactive &&
          "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export function MetricCard({
  label,
  value,
  context,
  dominant = false,
  loading = false,
  quiet = false,
  onRetry,
}: {
  label: string;
  value?: string | number;
  context?: string;
  dominant?: boolean;
  loading?: boolean;
  quiet?: boolean;
  onRetry?: () => void;
}) {
  return (
    <article
      aria-busy={loading}
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-card",
        dominant ? "p-6 md:p-8" : "p-4",
      )}
    >
      <h2 className={cn("font-medium text-foreground-muted", dominant ? "text-sm" : "text-xs")}>{label}</h2>
      {loading ? (
        <div className="mt-3 h-12 max-w-[8rem] animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      ) : (
        <p
          className={cn(
            "tabular-figures mt-2 font-semibold tracking-tight",
            quiet ? "text-2xl text-foreground-muted" : "text-foreground",
            !quiet && dominant && "text-5xl",
            !quiet && !dominant && "text-3xl",
          )}
        >
          {value}
        </p>
      )}
      {context ? <p className="mt-2 text-sm text-foreground-muted">{context}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </article>
  );
}

export function StatusCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <h3 className="text-xs font-medium text-foreground-muted">{label}</h3>
      <div className="mt-2 text-sm text-foreground">{children}</div>
    </article>
  );
}
