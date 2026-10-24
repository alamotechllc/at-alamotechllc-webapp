export const ANALYTICS_EVENTS = {
  loginViewed: "login_viewed",
  loginStarted: "login_started",
  loginCompleted: "login_completed",
  logout: "logout",
  commandCenterViewed: "command_center_viewed",
  raasOverviewViewed: "raas_overview_viewed",
  clientsViewed: "clients_viewed",
  appointmentsViewed: "appointments_viewed",
  resultsViewed: "results_viewed",
  operationsViewed: "operations_viewed",
  reportingPeriodChanged: "reporting_period_changed",
  refreshRequested: "refresh_requested",
  retryRequested: "retry_requested",
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export interface AnalyticsScreen {
  pagePath: string;
  title: string;
  event: AnalyticsEventName;
}

export interface AnalyticsGate {
  dev: boolean;
  emulator: boolean;
  channel: string;
  hostname: string;
  measurementId: string;
  appId: string;
}

/** Production Hosting only. Local, emulator, and preview builds stay out of the production stream. */
export function analyticsShouldCollect(gate: AnalyticsGate): boolean {
  if (gate.dev || gate.emulator || gate.channel !== "production") return false;
  if (!gate.measurementId.startsWith("G-") || !gate.appId) return false;
  const host = gate.hostname.toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1" || host.includes("--")) return false;
  return true;
}

/** Generic screen paths. Tenant ids and other record identifiers are not analytics properties. */
export function screenForPath(pathname: string): AnalyticsScreen | null {
  const path = pathname.replace(/^\/raas(?=\/|$)/, "") || "/";
  if (path === "/sign-in") {
    return { pagePath: "/sign-in", title: "Login", event: ANALYTICS_EVENTS.loginViewed };
  }
  if (path === "/") {
    return { pagePath: "/", title: "RaaS Overview", event: ANALYTICS_EVENTS.raasOverviewViewed };
  }
  if (path === "/clients") {
    return { pagePath: "/clients", title: "Clients", event: ANALYTICS_EVENTS.clientsViewed };
  }
  if (/^\/clients\/[^/]+$/.test(path)) {
    return { pagePath: "/clients/detail", title: "Client", event: ANALYTICS_EVENTS.clientsViewed };
  }
  if (path === "/appointments") {
    return { pagePath: "/appointments", title: "Appointments", event: ANALYTICS_EVENTS.appointmentsViewed };
  }
  if (path === "/results") {
    return { pagePath: "/results", title: "Results", event: ANALYTICS_EVENTS.resultsViewed };
  }
  if (path === "/operations") {
    return { pagePath: "/operations", title: "Operations", event: ANALYTICS_EVENTS.operationsViewed };
  }
  return null;
}
