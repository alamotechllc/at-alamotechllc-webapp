import { collection, getDocs, query, where, type DocumentData } from "firebase/firestore";
import type { ActionCompletion, CustomerAction } from "../../../packages/domain/src/actionCenter.js";
import { clientDb } from "./auth";

function text(data: DocumentData, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

function optionalText(data: DocumentData, key: string): string | undefined {
  const value = data[key];
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

function optionalNumber(data: DocumentData, key: string): number {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function mapActionDoc(id: string, data: DocumentData): CustomerAction | null {
  const tenantId = text(data, "tenantId");
  const title = text(data, "title");
  const assignedTo = text(data, "assignedTo");
  const createdAt = text(data, "createdAt");
  if (!tenantId || !title || !assignedTo || !createdAt) return null;
  return {
    id: text(data, "actionId") || id,
    tenantId,
    title,
    description: optionalText(data, "description"),
    assignedTo: assignedTo as CustomerAction["assignedTo"],
    priority: optionalNumber(data, "priority"),
    actionLabel: optionalText(data, "actionLabel"),
    actionUrl: optionalText(data, "actionUrl"),
    createdAt,
  };
}

/** Unfiltered action lists fail rules when any tenant action is user-private. Query by assignment. */
export async function loadCustomerActions(tenantId: string, uid: string): Promise<CustomerAction[]> {
  if (!clientDb) throw new Error("Firebase web configuration is missing.");
  const col = collection(clientDb, "tenants", tenantId, "actions");
  const [shared, assigned] = await Promise.all([
    getDocs(query(col, where("assignedTo", "==", "all"))),
    getDocs(query(col, where("assignedTo", "==", uid))),
  ]);
  const byId = new Map<string, CustomerAction>();
  for (const docSnap of [...shared.docs, ...assigned.docs]) {
    const mapped = mapActionDoc(docSnap.id, docSnap.data());
    if (mapped) byId.set(mapped.id, mapped);
  }
  return [...byId.values()];
}

export async function loadActionCompletions(tenantId: string, uid: string): Promise<ActionCompletion[]> {
  if (!clientDb) throw new Error("Firebase web configuration is missing.");
  const snap = await getDocs(collection(clientDb, "tenants", tenantId, "members", uid, "actionCompletions"));
  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      actionId: text(data, "actionId") || docSnap.id,
      tenantId: text(data, "tenantId"),
      completedAt: text(data, "completedAt"),
    };
  });
}
