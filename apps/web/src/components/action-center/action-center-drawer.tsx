import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { safeActionUrl } from "../../../../../packages/domain/src/actionCenter.js";
import { useActionCenter } from "../../action-center-context";
import { cn } from "../../lib/cn";
import { Button } from "../ui/button";

export function ActionCenterDrawer() {
  const { open, setOpen, view, loading, error, complete, completingId } = useActionCenter();
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

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

  const selection = view?.selection;
  const completed = view?.completed ?? [];
  const progress = view?.progress;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-background/80" aria-label="Close Next Steps" onClick={() => setOpen(false)} />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex h-full w-full max-w-full flex-col bg-background shadow-card",
          "sm:max-w-[min(100%,26rem)] md:max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
              Next Steps
            </h2>
            <p className="mt-0.5 text-sm text-foreground-muted">What we need from you next</p>
          </div>
          <Button variant="outline" className="h-10 w-10 shrink-0 px-0" aria-label="Close" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? <p className="text-sm text-foreground-muted">Loading next steps…</p> : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {progress && selection ? (
            <div className="space-y-2">
              {selection.visibleCount > 0 ? (
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {selection.visibleCount} {selection.visibleCount === 1 ? "thing needs" : "things need"} your attention
                </p>
              ) : progress.caughtUp ? (
                <p className="text-xl font-semibold text-foreground">You&apos;re all caught up</p>
              ) : null}
              {progress.totalCount > 0 ? (
                <>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div
                      className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-200 motion-reduce:transition-none"
                      style={{ transform: `scaleX(${(progress.percent ?? 0) / 100})` }}
                    />
                  </div>
                  <p className="text-sm text-foreground-muted">{progress.detail}</p>
                </>
              ) : null}
            </div>
          ) : null}

          {selection && selection.visible.length > 0 ? (
            <ol className="mt-8 space-y-6" aria-label="Your next steps">
              {selection.visible.map((action, index) => (
                <li key={action.id} className="border-b border-border pb-6 last:border-b-0 last:pb-0">
                  <p className="text-xs font-semibold tabular-nums text-foreground-muted">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">{action.title}</p>
                  {action.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{action.description}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" disabled={completingId === action.id} onClick={() => void complete(action.id)}>
                      Mark Complete
                    </Button>
                    {action.actionLabel && safeActionUrl(action.actionUrl) ? (
                      <ActionCta label={action.actionLabel} url={safeActionUrl(action.actionUrl)!} onNavigate={() => setOpen(false)} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {selection && selection.visible.length === 0 && progress?.caughtUp && progress.totalCount > 0 ? (
            <p className="mt-8 text-sm text-foreground-muted">You&apos;re all caught up on assigned next steps.</p>
          ) : null}

          {selection && selection.additionalCount > 0 ? (
            <p className="mt-6 text-sm text-foreground-muted">{selection.additionalCount} additional steps remaining</p>
          ) : null}

          {completed.length > 0 ? (
            <section className="mt-8 border-t border-border pt-5">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-foreground"
                aria-expanded={completedOpen}
                onClick={() => setCompletedOpen((value) => !value)}
              >
                <span>Completed ({completed.length})</span>
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
    "inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted";
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
