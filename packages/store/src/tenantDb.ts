import type { CollectionReference, DocumentReference, Firestore } from "firebase-admin/firestore";
import { ApiError } from "@raas/domain";

const OPERATIONAL_COLLECTIONS = new Set([
  "members",
  "serviceInstances",
  "campaigns",
  "providerBindings",
  "leads",
  "appointments",
  "businessEvents",
  "auditEvents",
  "idempotency",
  "deadLetters",
  "actions",
]);

export function requireTenantId(tenantId: string): string {
  if (!tenantId || tenantId.includes("/") || tenantId.includes("*")) {
    throw new ApiError(400, "VALIDATION_FAILED", "tenantId is required.", [
      { field: "tenantId", issue: "required" },
    ]);
  }
  return tenantId;
}

export function tenantRoot(db: Firestore, tenantId: string): DocumentReference {
  return db.doc(`tenants/${requireTenantId(tenantId)}`);
}

export function tenantCollection(db: Firestore, tenantId: string, collection: string): CollectionReference {
  if (!OPERATIONAL_COLLECTIONS.has(collection)) {
    throw new ApiError(400, "VALIDATION_FAILED", "Collection is not part of the tenant boundary.", [
      { field: "collection", issue: "unscoped" },
    ]);
  }
  return db.collection(`tenants/${requireTenantId(tenantId)}/${collection}`);
}

export function tenantDoc(db: Firestore, tenantId: string, collection: string, id: string): DocumentReference {
  if (!id || id.includes("/")) {
    throw new ApiError(400, "VALIDATION_FAILED", "Document id is required.", [
      { field: "id", issue: "required" },
    ]);
  }
  return tenantCollection(db, tenantId, collection).doc(id);
}
