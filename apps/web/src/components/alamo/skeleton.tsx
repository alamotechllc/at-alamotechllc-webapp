import { cn } from "../../lib/cn";

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div
      className={cn("space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card", className)}
      role="status"
      aria-busy="true"
    >
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="h-10 w-32" />
      {lines > 2 ? <SkeletonBlock className="h-3 w-full max-w-md" /> : null}
      {lines > 3 ? <SkeletonBlock className="h-3 w-4/5" /> : null}
    </div>
  );
}
