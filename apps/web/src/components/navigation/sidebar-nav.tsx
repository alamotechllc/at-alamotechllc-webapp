import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  Home,
  ListTodo,
  Megaphone,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { hasPermission, isStaffRole, type Permission, type RaasRole } from "../../../../../packages/domain/src/rbac";
import { cn } from "../../lib/cn";

const NAV: {
  to: string;
  label: string;
  end: boolean;
  permission: Permission;
  staffOnly?: boolean;
  icon: LucideIcon;
  group: "primary" | "staff";
}[] = [
  { to: "/", label: "Home", end: true, permission: "tenant.read", icon: Home, group: "primary" },
  { to: "/tasks", label: "Tasks", end: false, permission: "task.read", icon: ListTodo, group: "primary" },
  { to: "/appointments", label: "Appointments", end: false, permission: "appointment.read", icon: CalendarDays, group: "primary" },
  { to: "/results", label: "Results", end: false, permission: "result.read", icon: BarChart3, group: "primary" },
  { to: "/campaigns", label: "Campaigns", end: false, permission: "tenant.read", icon: Megaphone, group: "primary" },
  { to: "/clients", label: "Clients", end: false, permission: "tenant.read", staffOnly: true, icon: Users, group: "staff" },
  { to: "/operations", label: "Operations", end: false, permission: "providerBinding.read", staffOnly: true, icon: Settings2, group: "staff" },
];

function NavItem({
  item,
  onNavigate,
}: {
  item: (typeof NAV)[number];
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const reduce = useReducedMotion();
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            "relative flex min-h-11 items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
            isActive ? "text-primary-foreground" : "text-foreground-muted hover:text-foreground",
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && !reduce ? (
              <motion.span
                layoutId="sidebar-active-pill"
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            {isActive && reduce ? <span className="absolute inset-0 rounded-full bg-primary" aria-hidden="true" /> : null}
            <Icon className="relative z-[1] h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" aria-hidden="true" />
            <span className="relative z-[1]">{item.label}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

export function SidebarNav({ role, onNavigate }: { role: RaasRole | null; onNavigate?: () => void }) {
  const staff = isStaffRole(role ?? undefined);
  const items = NAV.filter(
    (item) => hasPermission(role ?? undefined, item.permission) && (!item.staffOnly || staff),
  );
  const primary = items.filter((item) => item.group === "primary");
  const staffItems = items.filter((item) => item.group === "staff");

  return (
    <nav aria-label="Command Center" className="mt-8 flex flex-1 flex-col">
      <div>
        <p className="px-3 text-xs font-medium text-foreground-muted">Lead capture</p>
        <ul className="mt-2 space-y-0.5">
          {primary.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
      </div>
      {staffItems.length > 0 ? (
        <div className="mt-8">
          <p className="px-3 text-xs font-medium text-foreground-muted">Operations</p>
          <ul className="mt-2 space-y-0.5">
            {staffItems.map((item) => (
              <NavItem key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
