import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { noticeCopy, unavailableLabel } from "../../view-state";
import { SkeletonCard } from "../alamo/skeleton";
import { Button } from "./button";

export function SectionHeader({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <header className="space-y-1.5 pb-1">
      <h1 className="text-2xl text-foreground md:text-[1.75rem]">{title}</h1>
      {detail ? <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted md:text-base">{detail}</p> : null}
    </header>
  );
}

export function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <div className="h-3 max-w-[12rem] animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
        <p className="sr-only">{label}</p>
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite">
      <SkeletonCard />
      <p className="sr-only">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
  secondaryAction,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-2 sm:flex-row sm:gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-foreground-muted">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-foreground-muted">{detail}</p>
        {action || secondaryAction ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {action}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ErrorState({
  failure,
  message,
  onRetry,
}: {
  failure: string;
  message: string;
  onRetry?: () => void;
}) {
  const copy = noticeCopy(failure, message);
  return (
    <div role="alert" className="rounded-lg border border-border border-l-4 border-l-error bg-card p-4 shadow-card">
      <h2 className="text-sm font-semibold text-foreground">{copy.title}</h2>
      <p className="mt-1 text-sm text-foreground-muted">{copy.detail}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function UnavailableValue({ failure }: { failure: string }) {
  return <p className="text-lg font-semibold text-foreground-muted">{unavailableLabel(failure)}</p>;
}

export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="border-b border-border px-3 py-2 text-left text-xs font-semibold text-foreground-muted">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-3 [&_td]:text-foreground">{children}</tbody>
      </table>
    </div>
  );
}
