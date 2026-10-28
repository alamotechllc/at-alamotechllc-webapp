import { Component, StrictMode, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { trackCommandCenterViewed, trackLoginCompleted, trackNavigation } from "./analytics";
import { authConfigError, authUsesEmulator, SessionProvider, useSession, type Access } from "./auth";
import { AlamoLogo } from "./components/layout/logo";
import { Shell } from "./components/layout/shell";
import { SystemTheme } from "./components/layout/theme";
import { Button } from "./components/ui/button";
import { AppCard } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { ErrorState, LoadingState } from "./components/ui/states";
import { AppointmentsPage, CampaignsPage, ClientPage, ClientsPage, OperationsPage, OverviewPage, ResultsPage } from "./pages";
import { TasksPage } from "./tasks-page";
import "./index.css";

function AccessCard({ access }: { access: Exclude<Access, "loading" | "anonymous" | "authorized"> }) {
  const session = useSession();
  const copy = {
    denied: {
      title: "Access not authorized",
      detail: "Your Google account was authenticated successfully, but it has not been granted access to the Alamo Tech platform.",
    },
    disabled: {
      title: "Account disabled",
      detail: "This account is signed in, and its access has been turned off.",
    },
    expired: {
      title: "Session expired",
      detail: "Sign in again to continue.",
    },
    unavailable: {
      title: "We couldn't confirm access",
      detail: "Authorization did not respond. Nothing was granted.",
    },
  }[access];
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <AppCard className="w-full max-w-md p-6 md:p-8">
        <AlamoLogo className="h-24 w-auto" />
        <h1 className="mt-4 text-2xl text-foreground">{copy.title}</h1>
        <p className="mt-3 text-sm text-foreground-muted" role="alert">{copy.detail}</p>
        <div className="mt-6 flex gap-3">
          {access === "unavailable" ? <Button variant="outline" onClick={session.retryAccess}>Retry</Button> : null}
          {access === "expired" ? <Button onClick={() => void session.signOut()}>Sign in</Button> : null}
          {access === "denied" || access === "disabled" ? <Button variant="outline" onClick={() => void session.signOut()}>Sign out</Button> : null}
        </div>
      </AppCard>
    </div>
  );
}

function ProductAnalytics() {
  const location = useLocation();
  const session = useSession();
  useEffect(() => {
    trackNavigation(location.pathname);
  }, [location.pathname]);
  useEffect(() => {
    if (session.access !== "authorized") return;
    trackLoginCompleted();
    trackCommandCenterViewed();
  }, [session.access]);
  return null;
}

function Gate() {
  const session = useSession();
  if (session.access === "loading") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <LoadingState label={session.user ? "Checking access" : "Checking sign-in"} />
      </div>
    );
  }
  if (session.access === "anonymous") return <Navigate to="/sign-in" replace />;
  if (session.access === "authorized") return <Shell />;
  return <AccessCard access={session.access} />;
}

function SignInPage() {
  const session = useSession();
  const [pending, setPending] = useState(false);
  if (session.access === "authorized") return <Navigate to="/" replace />;
  if (session.user && (session.access === "denied" || session.access === "disabled" || session.access === "unavailable")) {
    return <AccessCard access={session.access} />;
  }
  if (authConfigError) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
        <AppCard className="w-full max-w-md p-6 md:p-8">
          <AlamoLogo className="h-24 w-auto" />
          <h1 className="mt-4 text-2xl text-foreground">Command Center</h1>
          <p className="mt-3 text-sm text-foreground-muted" role="alert">{authConfigError}</p>
        </AppCard>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    try {
      await session.signIn(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <AppCard className="w-full max-w-md p-6 md:p-8">
        <AlamoLogo className="h-24 w-auto" />
        <h1 className="mt-4 text-2xl text-foreground">Command Center</h1>
        <p className="mt-1 text-sm text-foreground-muted">Sign in to view your business results and next steps.</p>
        <div className="mt-6 space-y-4">
          <Button className="h-11 w-full" type="button" onClick={() => void session.signInWithGoogle()}>Continue with Google</Button>
          {session.authError ? <p role="alert" className="text-sm text-error-foreground">{session.authError}</p> : null}
        </div>
        {authUsesEmulator ? (
        <form className="mt-6 space-y-4 border-t border-border pt-6" onSubmit={(event) => void onSubmit(event)}>
          <p className="text-sm text-foreground-muted">Local emulator</p>
          <label className="block text-sm font-medium text-foreground" htmlFor="email">
            Email
            <Input className="mt-1.5" id="email" name="email" type="email" autoComplete="username" required />
          </label>
          <label className="block text-sm font-medium text-foreground" htmlFor="password">
            Password
            <Input className="mt-1.5" id="password" name="password" type="password" autoComplete="current-password" required />
          </label>
          {session.authError ? <p role="alert" className="text-sm text-error-foreground">{session.authError}</p> : null}
          <Button className="h-11 w-full" type="submit" disabled={pending}>{pending ? "Signing in" : "Sign in"}</Button>
        </form>
        ) : null}
      </AppCard>
    </div>
  );
}

function LegacyRaasRedirect() {
  const location = useLocation();
  const next = location.pathname.replace(/^\/raas(?=\/|$)/, "") || "/";
  return <Navigate to={`${next}${location.search}${location.hash}`} replace />;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { message: string }> {
  state = { message: "" };

  static getDerivedStateFromError(error: Error): { message: string } {
    return { message: error.message };
  }

  render() {
    if (this.state.message) {
      return (
        <div className="mx-auto max-w-lg px-4 py-16">
          <ErrorState failure="error" message={this.state.message} />
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <SystemTheme>
        <SessionProvider>
          <BrowserRouter>
            <ProductAnalytics />
            <Routes>
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/raas/*" element={<LegacyRaasRedirect />} />
              <Route path="/raas" element={<LegacyRaasRedirect />} />
              <Route element={<Gate />}>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/:tenantId" element={<ClientPage />} />
                <Route path="/campaigns" element={<CampaignsPage />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/operations" element={<OperationsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SessionProvider>
      </SystemTheme>
    </AppErrorBoundary>
  </StrictMode>,
);
