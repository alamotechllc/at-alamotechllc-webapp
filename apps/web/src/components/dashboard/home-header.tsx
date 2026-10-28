import { StatusBadge, statusTone } from "../ui/badge";
import { timeGreeting } from "../../lib/greeting";

export function HomeHeader({
  organization,
  serviceStatus,
  periodDays,
}: {
  organization?: string;
  serviceStatus?: string;
  periodDays: number;
}) {
  const greeting = timeGreeting();
  const active = serviceStatus === "active";

  return (
    <header className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-foreground-muted">Command Center</p>
          <p className="text-sm font-medium text-foreground-muted">{greeting}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Home</h1>
          <p className="text-sm text-foreground-muted md:text-base">
            {organization
              ? `${organization}. Lead Capture, last ${periodDays} days.`
              : `Lead Capture, last ${periodDays} days.`}
          </p>
        </div>
        {serviceStatus ? (
          <span className="shrink-0 self-start">
            <StatusBadge tone={statusTone(serviceStatus)}>{active ? "Service active" : serviceStatus}</StatusBadge>
          </span>
        ) : null}
      </div>
    </header>
  );
}
