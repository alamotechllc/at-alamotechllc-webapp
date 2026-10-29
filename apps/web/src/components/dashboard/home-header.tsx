import { timeGreeting } from "../../lib/greeting";
import { PageHeader } from "../alamo/page-header";
import { StatusBadge, statusTone } from "../ui/badge";

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
    <PageHeader
      eyebrow={`Command Center · ${greeting}`}
      title="Home"
      detail={
        organization
          ? `${organization} · Lead Capture · last ${periodDays} days`
          : `Lead Capture · last ${periodDays} days`
      }
      aside={
        serviceStatus ? (
          <StatusBadge tone={statusTone(serviceStatus)}>{active ? "Service active" : serviceStatus}</StatusBadge>
        ) : null
      }
    />
  );
}
