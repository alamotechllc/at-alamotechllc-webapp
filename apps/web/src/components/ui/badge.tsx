import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type StatusTone = "success" | "warning" | "error" | "muted";

const TONE: Record<StatusTone, string> = {
  success: "border-success/30 bg-success/10 text-success-foreground",
  warning: "border-warning/30 bg-warning/10 text-warning-foreground",
  error: "border-error/30 bg-error/10 text-error-foreground",
  muted: "border-border bg-muted text-foreground-muted",
};

export function statusTone(value: string): StatusTone {
  const normalized = value.toLowerCase();
  if (normalized === "active" || normalized === "healthy") return "success";
  if (normalized === "warning" || normalized === "degraded" || normalized === "unavailable") return "warning";
  if (normalized === "error" || normalized === "unauthorized") return "error";
  return "muted";
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", TONE[tone])}>
      {children}
    </span>
  );
}
