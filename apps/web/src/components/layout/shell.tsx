import { Menu } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
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
  if (role === "tenant_viewer") return "Viewer";
  return "Signed in";
}

export function Shell() {
  const session = useSession();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ActionCenterProvider>
      <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        {open ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-primary/50 backdrop-blur-[2px] lg:hidden"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
        ) : null}
        <aside
          id={menuId}
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 text-sidebar-foreground lg:static",
            open ? "flex" : "hidden lg:flex",
          )}
        >
          <AlamoLogo className="h-14 w-auto self-start" />
          <p className="mt-3 px-3 text-xs font-medium text-foreground-muted">Customer Command Center</p>
          {session.access === "authorized" ? <SidebarNav role={session.role} onNavigate={() => setOpen(false)} /> : null}
          <p className="mt-auto px-3 pb-1 text-[0.6875rem] text-foreground-muted">Release {releaseLabel()}</p>
        </aside>
        <div className="flex min-w-0 flex-col bg-surface-muted/40">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:h-16 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="outline"
                className="h-11 w-11 shrink-0 px-0 lg:hidden"
                aria-label="Open navigation"
                aria-expanded={open}
                aria-controls={menuId}
                onClick={() => setOpen(true)}
              >
                <Menu aria-hidden="true" className="h-5 w-5" />
              </Button>
              <p className="truncate text-sm font-semibold text-foreground lg:hidden">Command Center</p>
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
              {session.access === "authorized" ? <NextStepsHeaderControl /> : null}
              <AccountMenu
                email={session.user?.email ?? "Signed in"}
                role={roleLabel(session.role)}
                onSignOut={() => void session.signOut()}
              />
            </div>
          </header>
          <main className="flex-1 bg-muted/30 px-4 py-6 md:px-6 md:py-8 lg:px-8">
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
      <summary className="flex min-h-11 max-w-[12rem] cursor-pointer list-none items-center rounded-lg border border-transparent px-2 hover:border-border hover:bg-card sm:max-w-[14rem] sm:px-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 text-right">
          <span className="block truncate text-sm font-medium text-foreground">{email}</span>
          <span className="block truncate text-xs text-foreground-muted">{role}</span>
        </span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-card">
        <Button variant="ghost" className="h-11 w-full justify-start" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </details>
  );
}
