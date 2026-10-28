import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl", className)}>{children}</div>;
}

export function PageSection({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("space-y-4", className)}>{children}</section>;
}
