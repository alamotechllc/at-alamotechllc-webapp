import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

export function KpiTile({
  label,
  value,
  hint,
  href,
  loading = false,
  className,
}: {
  label: string;
  value?: string | number;
  hint?: string;
  href?: string | null;
  loading?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-foreground-muted">{label}</p>
      {loading ? (
        <div className="mt-3 h-10 w-20 animate-pulse rounded-md bg-muted motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <p className="tabular-figures mt-2 text-4xl font-semibold tracking-tight text-foreground">{value}</p>
      )}
      {hint ? <p className="mt-2 text-sm text-foreground-muted">{hint}</p> : null}
    </>
  );

  const classes = cn(
    "rounded-lg border border-border bg-card p-5 shadow-card transition-shadow",
    href && "hover:border-accent/40 hover:shadow-md active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );

  if (href) {
    return (
      <Link to={href} className={classes}>
        {body}
      </Link>
    );
  }
  return <article className={classes}>{body}</article>;
}
