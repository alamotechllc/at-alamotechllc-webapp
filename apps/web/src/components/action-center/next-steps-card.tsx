import { ChevronRight } from "lucide-react";
import { useActionCenter } from "../../action-center-context";
import { AppCard } from "../ui/card";

export function NextStepsCard() {
  const { view, loading, error, setOpen } = useActionCenter();

  if (loading && !view) {
    return (
      <AppCard className="p-5" aria-busy="true" role="status">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          <div className="h-8 w-full animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          <div className="h-8 w-4/5 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        </div>
      </AppCard>
    );
  }
  if (error && !view) {
    return (
      <AppCard className="p-5" role="alert">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Next Steps</p>
        <p className="mt-3 text-sm text-destructive">{error}</p>
      </AppCard>
    );
  }

  if (!view) return null;

  const { progress, selection } = view;
  const pending = selection.visible;
  const caughtUp = progress.caughtUp && selection.visibleCount === 0;

  return (
    <AppCard className="overflow-hidden border-accent/20 bg-card p-0 shadow-sm">
      <button
        type="button"
        className="w-full p-5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={() => setOpen(true)}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Next Steps</p>
        {caughtUp ? (
          <div className="mt-3 space-y-1">
            <p className="text-lg font-semibold text-foreground">You&apos;re all caught up</p>
            <p className="text-sm text-foreground-muted">Nothing needs your attention right now.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-xl font-bold tracking-tight text-foreground">
              {selection.visibleCount} {selection.visibleCount === 1 ? "thing needs" : "things need"} your attention
            </p>
            <ul className="space-y-2">
              {pending.slice(0, 3).map((action) => (
                <li key={action.id} className="flex items-start gap-2 text-sm text-foreground-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <span className="line-clamp-2">{action.title}</span>
                </li>
              ))}
            </ul>
            {progress.percent !== null && progress.percent > 0 ? (
              <p className="text-xs text-foreground-muted">{progress.detail}</p>
            ) : null}
          </div>
        )}
        <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
          View all next steps
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </p>
      </button>
    </AppCard>
  );
}
