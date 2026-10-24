import { collection, doc, getDoc, getDocs, type DocumentData } from "firebase/firestore";
import { clientDb } from "./auth";
import type { ViewFailure } from "./metrics";

export class ReadFailure extends Error {
  constructor(readonly failure: ViewFailure, message: string) {
    super(message);
  }
}

function text(data: DocumentData, key: string): string {
  const value = data[key];
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return "";
}

async function readPath(path: string): Promise<unknown> {
  if (!clientDb) throw new ReadFailure("error", "Firebase web configuration is missing.");
  const url = new URL(path, "https://local.invalid");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "v1" || parts[1] !== "tenants" || !parts[2]) {
    throw new ReadFailure("error", "This view is not available.");
  }
  const tenantId = parts[2];
  const resource = parts[3];
  if (resource === "provider-bindings" || resource === "events") return { items: [] };

  if (!resource) {
    const snap = await getDoc(doc(clientDb, "tenants", tenantId));
    if (!snap.exists()) throw new ReadFailure("error", "This client was not found.");
    const data = snap.data();
    return {
      tenantId,
      legalName: text(data, "legalName"),
      status: text(data, "status"),
      timezone: text(data, "timezone"),
    };
  }

  if (resource === "service-instances") {
    const snap = await getDocs(collection(clientDb, "tenants", tenantId, "serviceInstances"));
    return {
      items: snap.docs.map((item) => ({
        instanceId: item.id,
        productCode: text(item.data(), "productCode"),
        status: text(item.data(), "status"),
        metricPolicyVersion: text(item.data(), "metricPolicyVersion"),
      })),
    };
  }

  if (resource === "appointments") {
    const snap = await getDocs(collection(clientDb, "tenants", tenantId, "appointments"));
    return {
      items: snap.docs.map((item) => ({
        appointmentId: item.id,
        status: text(item.data(), "status"),
        provider: text(item.data(), "provider"),
        providerAppointmentId: text(item.data(), "providerAppointmentId"),
        startAt: text(item.data(), "startAt"),
        endAt: text(item.data(), "endAt"),
        timezone: text(item.data(), "timezone"),
      })),
    };
  }

  if (resource === "results") {
    const instanceId = url.searchParams.get("serviceInstanceId") ?? "";
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const snap = await getDocs(collection(clientDb, "tenants", tenantId, "appointments"));
    const booked = snap.docs.filter((item) => {
      const start = text(item.data(), "startAt");
      const instance = text(item.data(), "serviceInstanceId");
      if (instanceId && instance !== instanceId) return false;
      if (from && start < from) return false;
      if (to && start >= to) return false;
      return true;
    }).length;
    return { metrics: { appointmentsBooked: { value: booked, unit: "count" } } };
  }

  throw new ReadFailure("error", "This view is not available.");
}

export async function readApplicationPath(path: string): Promise<unknown> {
  try {
    return await readPath(path);
  } catch (error) {
    if (error instanceof ReadFailure) throw error;
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code.includes("permission-denied") || code.includes("unauthenticated")) {
      throw new ReadFailure("unauthorized", "Access is not authorized.");
    }
    if (code.includes("unavailable") || code.includes("deadline-exceeded") || code.includes("network-request-failed")) {
      throw new ReadFailure("unavailable", "The data service did not respond.");
    }
    throw new ReadFailure("error", "The request failed.");
  }
}
