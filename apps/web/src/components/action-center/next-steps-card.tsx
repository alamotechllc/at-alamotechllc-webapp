import type { KeyboardEvent } from "react";
import { useActionCenter } from "../../action-center-context";
import { AppCard } from "../ui/card";

export function NextStepsCard() {
  const { view, loading, error, setOpen } = useActionCenter();

  function openFromCard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }
  if (loading && !view) {
    return (
      <AppCard className="p-6 md:p-8" aria-busy="true">
        <p className="text-sm text-foreground-muted">Loading your progress…</p>
      </AppCard>
    );
  }
  if (error && !view) {
    return (
      <AppCard className="p-6 md:p-8" role="alert">
        <h2 className="text-sm font-medium text-foreground-muted">Your progress</h2>
        <p className="mt-3 text-sm text-destructive">{error}</p>
      </AppCard>
    );
  }

  if (!view) return null;

  const { progress, selection, pending } = view;
  const attention = selection.visibleCount;
  const preview = selection.visible[0];

  return (
    <AppCard
      className="cursor-pointer p-6 transition-shadow hover:shadow-md md:p-8"
      aria-labelledby="next-steps-progress"
      role="button"
      tabIndex={0}
      onClick={() => setOpen(true)}
      onKeyDown={openFromCard}
    >
      <h2 id="next-steps-progress" className="text-sm font-medium text-foreground-muted">
        Your progress
      </h2>
      {progress.caughtUp && progress.totalCount === 0 ? (
        <p className="mt-3 text-2xl font-bold tracking-tight">{progress.label}</p>
      ) : (
        <>
          <p className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{progress.label}</p>
          <div className="mt-4 h-2 w-full max-w-md rounded-full bg-muted" aria-hidden="true">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${progress.percent ?? 0}%` }} />
          </div>
          <p className="mt-2 text-sm text-foreground-muted">{progress.detail}</p>
        </>
      )}
      {attention > 0 ? (
        <p className="mt-4 text-sm font-medium text-foreground">
          {attention} {attention === 1 ? "thing needs" : "things need"} your attention
        </p>
      ) : null}
      {preview ? <p className="mt-2 break-words text-sm text-foreground-muted">{preview.title}</p> : null}
      {pending.length === 0 && progress.totalCount > 0 ? (
        <p className="mt-2 text-sm text-foreground-muted">You&apos;re all caught up.</p>
      ) : null}
      <p className="mt-5 text-sm font-medium text-accent">View Next Steps →</p>
    </AppCard>
  );
}
