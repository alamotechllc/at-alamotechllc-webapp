import type { ReactNode } from "react";
import { noticeCopy, unavailableLabel } from "../../view-state";
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
      <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[1.75rem]">{title}</h1>
      {detail ? <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted md:text-base">{detail}</p> : null}
    </header>
  );
}

export function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm"} role="status">
      <div className="h-3 max-w-[12rem] animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
      <div className="h-3 max-w-[8rem] animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
      <p className="text-sm text-foreground-muted">{label}</p>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-foreground-muted">{detail}</p>
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
    <div role="alert" className="rounded-lg border border-border border-l-4 border-l-error bg-card p-4 shadow-sm">
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
