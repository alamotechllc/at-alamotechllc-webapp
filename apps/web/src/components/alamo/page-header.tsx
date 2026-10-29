import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function PageHeader({
  eyebrow,
  title,
  detail,
  aside,
  className,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? <p className="text-xs font-medium text-foreground-muted">{eyebrow}</p> : null}
          <h1 className="text-2xl text-foreground md:text-[1.75rem]">{title}</h1>
          {detail ? <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted md:text-base">{detail}</p> : null}
        </div>
        {aside ? <div className="shrink-0 self-start">{aside}</div> : null}
      </div>
    </header>
  );
}

export function DashboardSection({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="space-y-0.5">
        <h2 className="text-xs font-medium text-foreground-muted">{label}</h2>
        {hint ? <p className="text-sm text-foreground-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
