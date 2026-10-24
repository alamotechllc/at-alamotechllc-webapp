import { NavLink } from "react-router-dom";
import { hasPermission, type Permission, type RaasRole } from "../../../../../packages/domain/src/rbac";
import { cn } from "../../lib/cn";

const NAV: { to: string; label: string; end: boolean; permission: Permission }[] = [
  { to: "/", label: "Overview", end: true, permission: "tenant.read" },
  { to: "/clients", label: "Clients", end: false, permission: "tenant.read" },
  { to: "/campaigns", label: "Campaigns", end: false, permission: "tenant.read" },
  { to: "/appointments", label: "Appointments", end: false, permission: "appointment.read" },
  { to: "/results", label: "Results", end: false, permission: "result.read" },
  { to: "/operations", label: "Operations", end: false, permission: "providerBinding.read" },
];

export function SidebarNav({ role, onNavigate }: { role: RaasRole | null; onNavigate?: () => void }) {
  const items = NAV.filter((item) => hasPermission(role ?? undefined, item.permission));
  return (
    <nav aria-label="RaaS" className="mt-6">
      <p className="px-3 text-xs font-semibold uppercase tracking-wide text-foreground-muted">RaaS</p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-foreground-muted hover:bg-muted hover:text-primary",
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
