import { mapGhlWebhook, type GhlAppointmentEvent } from "./mapAppointment.js";

export interface ReconciliationWindow {
  externalAccountId: string;
  from: string;
  to: string;
}

export interface ReconciliationCounts {
  reconcileMode: "pull" | "webhook_only";
  seen: number | null;
  submitted: number;
  replayed: number;
}

/**
 * Future pull source. A live client calls GoHighLevel
 * GET /calendars/events and returns the vendor rows. This milestone has no client.
 */
export interface GhlCalendarEventSource {
  listAppointments(window: ReconciliationWindow): Promise<unknown[]>;
}

export interface AppointmentReconciler {
  reconcile(window: ReconciliationWindow): Promise<ReconciliationCounts>;
}

export function createAppointmentReconciler(options: {
  reconcileMode: "pull" | "webhook_only";
  source?: GhlCalendarEventSource;
  submit?: (event: GhlAppointmentEvent) => Promise<{ replayed: boolean }>;
  now?: () => Date;
}): AppointmentReconciler {
  return {
    async reconcile(window) {
      if (options.reconcileMode !== "pull" || !options.source || !options.submit) {
        return { reconcileMode: "webhook_only", seen: null, submitted: 0, replayed: 0 };
      }
      const rows = await options.source.listAppointments(window);
      let submitted = 0;
      let replayed = 0;
      for (const row of rows) {
        const mapped = mapGhlWebhook(row, window.externalAccountId, options.now?.() ?? new Date());
        if (mapped.kind !== "event") continue;
        const result = await options.submit(mapped.event);
        if (result.replayed) replayed += 1;
        else submitted += 1;
      }
      return { reconcileMode: "pull", seen: rows.length, submitted, replayed };
    },
  };
}
