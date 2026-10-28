import { Menu } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Outlet } from "react-router-dom";
import { useSession } from "../../auth";
import type { RaasRole } from "../../../../../packages/domain/src/rbac";
import { releaseLabel } from "../../release";
import { cn } from "../../lib/cn";
import { ActionCenterProvider } from "../../action-center-context";
import { ActionCenterDrawer } from "../action-center/action-center-drawer";
import { NextStepsHeaderControl } from "../action-center/header-control";
import { SidebarNav } from "../navigation/sidebar-nav";
import { Button } from "../ui/button";
import { AlamoLogo } from "./logo";

function roleLabel(role: RaasRole | null): string {
  if (role === "platform_admin") return "Platform admin";
  if (role === "operator") return "Operator";
  if (role === "tenant_admin") return "Tenant admin";
  if (role === "tenant_viewer") return "Tenant viewer";
  return "Signed in";
}

export function Shell() {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ActionCenterProvider>
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-primary/40 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        id={menuId}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground lg:static",
          open ? "flex" : "hidden lg:flex",
        )}
      >
        <AlamoLogo className="h-20 w-auto self-start" />
        <p className="mt-4 px-3 text-sm font-semibold text-primary">Command Center</p>
        {session.access === "authorized" ? <SidebarNav role={session.role} onNavigate={() => setOpen(false)} /> : null}
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
          <Button
            variant="outline"
            className="h-11 w-11 px-0 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen(true)}
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </Button>
          <p className="hidden text-sm font-semibold text-primary lg:block">Command Center</p>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {session.access === "authorized" ? <NextStepsHeaderControl /> : null}
            <AccountMenu email={session.user?.email ?? "Signed in"} role={roleLabel(session.role)} onSignOut={() => void session.signOut()} />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
    <ActionCenterDrawer />
    </ActionCenterProvider>
  );
}

function AccountMenu({
  email,
  role,
  onSignOut,
}: {
  email: string;
  role: string;
  onSignOut: () => void;
}) {
  return (
    <details className="relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md px-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="text-right">
          <span className="block max-w-[14rem] truncate text-sm font-medium text-foreground">{email}</span>
          <span className="block text-xs text-foreground-muted">{role}</span>
        </span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-card">
        <p className="px-3 py-2 text-xs text-foreground-muted">Release {releaseLabel()}</p>
        <Button variant="ghost" className="h-11 w-full justify-start" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </details>
  );
}
