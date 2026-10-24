import { getApp } from "firebase/app";
import {
  ANALYTICS_EVENTS,
  analyticsShouldCollect,
  screenForPath,
  type AnalyticsGate,
} from "./analytics-catalog";

interface ViteEnv {
  DEV?: boolean;
  VITE_DEPLOY_CHANNEL?: string;
  VITE_USE_FIREBASE_EMULATORS?: string;
  VITE_FIREBASE_MEASUREMENT_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
}

type AnalyticsParams = Record<string, string>;

let ready = false;
let starting = false;
let lastPage = "";
let commandCenterSent = false;
let pendingLogin: "google" | "password" | "" = "";
let retryTimer = 0;
const queue: Array<{ name: string; params: AnalyticsParams }> = [];

function viteEnv(): ViteEnv {
  return (import.meta as unknown as { env: ViteEnv }).env;
}

export function currentAnalyticsGate(hostname = typeof window === "undefined" ? "" : window.location.hostname): AnalyticsGate {
  const env = viteEnv();
  const dev = Boolean(env.DEV);
  return {
    dev,
    emulator: env.VITE_USE_FIREBASE_EMULATORS === "true",
    channel: env.VITE_DEPLOY_CHANNEL || (dev ? "local" : "unknown"),
    hostname,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "",
    appId: env.VITE_FIREBASE_APP_ID || "",
  };
}

function emit(name: string, params: AnalyticsParams): void {
  if (!analyticsShouldCollect(currentAnalyticsGate())) return;
  queue.push({ name, params });
  void flush();
}

async function flush(): Promise<void> {
  if (ready) {
    const { logEvent } = await import("firebase/analytics");
    const { getAnalytics } = await import("firebase/analytics");
    const analytics = getAnalytics(getApp());
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) logEvent(analytics, item.name, item.params);
    }
    return;
  }
  if (starting) return;
  starting = true;
  const { initializeAnalytics, isSupported } = await import("firebase/analytics");
  if (!(await isSupported())) {
    queue.length = 0;
    return;
  }
  initializeAnalytics(getApp(), { config: { send_page_view: false } });
  ready = true;
  await flush();
}

export function trackNavigation(pathname: string): void {
  const screen = screenForPath(pathname);
  if (!screen || lastPage === screen.pagePath) return;
  lastPage = screen.pagePath;
  emit("page_view", { page_path: screen.pagePath, page_title: screen.title });
  emit(screen.event, { screen: screen.pagePath });
}

export function trackCommandCenterViewed(): void {
  if (commandCenterSent) return;
  commandCenterSent = true;
  emit(ANALYTICS_EVENTS.commandCenterViewed, { screen: "command_center" });
}

export function trackLoginStarted(method: "google" | "password"): void {
  pendingLogin = method;
  emit(ANALYTICS_EVENTS.loginStarted, { method });
}

export function trackLoginCompleted(): void {
  if (!pendingLogin) return;
  const method = pendingLogin;
  pendingLogin = "";
  emit(ANALYTICS_EVENTS.loginCompleted, { method });
}

export function trackLogout(): void {
  pendingLogin = "";
  emit(ANALYTICS_EVENTS.logout, { screen: "command_center" });
}

export function trackReportingPeriodChanged(): void {
  emit(ANALYTICS_EVENTS.reportingPeriodChanged, { screen: "results" });
}

export function trackRefreshRequested(): void {
  emit(ANALYTICS_EVENTS.refreshRequested, { screen: "application" });
}

export function trackRetryRequested(): void {
  if (typeof window === "undefined") {
    emit(ANALYTICS_EVENTS.retryRequested, { screen: "application" });
    return;
  }
  window.clearTimeout(retryTimer);
  retryTimer = window.setTimeout(() => {
    emit(ANALYTICS_EVENTS.retryRequested, { screen: "application" });
  }, 0);
}
