import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { safeActionUrl } from "../../../../../packages/domain/src/actionCenter.js";
import { useActionCenter } from "../../action-center-context";
import { cn } from "../../lib/cn";
import { Button } from "../ui/button";

export function ActionCenterDrawer() {
  const { open, setOpen, view, loading, error, complete, completingId } = useActionCenter();
  const titleId = useId();
  const [completedOpen, setCompletedOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const progress = view?.progress;
  const selection = view?.selection;
  const completed = view?.completed ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-primary/40" aria-label="Close Next Steps" onClick={() => setOpen(false)} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex h-full w-full max-w-full flex-col border-l border-border bg-background shadow-card",
          "sm:max-w-[min(100%,28rem)] md:max-w-[30rem]",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              Next Steps
            </h2>
            <p className="text-sm text-foreground-muted">Your Progress</p>
          </div>
          <Button variant="outline" className="h-10 w-10 shrink-0 px-0" aria-label="Close" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? <p className="text-sm text-foreground-muted">Loading next steps…</p> : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {progress ? (
            <div className="space-y-2">
              {progress.caughtUp && progress.totalCount === 0 ? (
                <p className="text-2xl font-bold tracking-tight">{progress.label}</p>
              ) : (
                <>
                  <p className="text-4xl font-bold tracking-tight">{progress.label}</p>
                  <ProgressBar percent={progress.percent ?? 0} />
                  <p className="text-sm text-foreground-muted">{progress.detail}</p>
                </>
              )}
            </div>
          ) : null}

          {selection && selection.visible.length > 0 ? (
            <section className="mt-8 space-y-3" aria-labelledby="next-steps-list">
              <h3 id="next-steps-list" className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                Your next steps
              </h3>
              <ol className="space-y-4">
                {selection.visible.map((action, index) => (
                  <li key={action.id} className="rounded-lg border border-border p-4">
                    <p className="text-xs font-medium text-foreground-muted">Step {index + 1}</p>
                    <p className="mt-1 font-semibold text-foreground">{action.title}</p>
                    {action.description ? <p className="mt-2 text-sm text-foreground-muted">{action.description}</p> : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {action.actionLabel && safeActionUrl(action.actionUrl) ? (
                        <ActionCta label={action.actionLabel} url={safeActionUrl(action.actionUrl)!} onNavigate={() => setOpen(false)} />
                      ) : null}
                      <Button
                        size="sm"
                        disabled={completingId === action.id}
                        onClick={() => void complete(action.id)}
                      >
                        Mark Complete
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
              {selection.additionalCount > 0 ? (
                <p className="text-sm text-foreground-muted">{selection.additionalCount} additional steps remaining</p>
              ) : null}
            </section>
          ) : null}

          {selection && selection.visible.length === 0 && progress && progress.totalCount > 0 && progress.caughtUp ? (
            <p className="mt-8 text-sm text-foreground-muted">You&apos;re all caught up on assigned next steps.</p>
          ) : null}

          {completed.length > 0 ? (
            <section className="mt-8 border-t border-border pt-4">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-foreground"
                aria-expanded={completedOpen}
                onClick={() => setCompletedOpen((value) => !value)}
              >
                <span>Completed ✓ {completed.length}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", completedOpen ? "rotate-180" : "")} aria-hidden="true" />
              </button>
              {completedOpen ? (
                <ul className="mt-3 space-y-2">
                  {completed.map((action) => (
                    <li key={action.id} className="text-sm text-foreground-muted">
                      {action.title}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function ActionCta({ label, url, onNavigate }: { label: string; url: string; onNavigate: () => void }) {
  const className =
    "inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted";
  if (url.startsWith("/")) {
    return (
      <Link to={url} onClick={onNavigate} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={className}>
      {label}
    </a>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true">
      <div className="h-2 rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  );
}
