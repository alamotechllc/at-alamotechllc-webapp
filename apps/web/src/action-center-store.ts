import { doc, setDoc } from "firebase/firestore";
import { clientDb } from "./auth";

export async function completeCustomerAction(input: {
  tenantId: string;
  uid: string;
  actionId: string;
}): Promise<void> {
  if (!clientDb) throw new Error("This step could not be saved.");
  const completedAt = new Date().toISOString();
  await setDoc(doc(clientDb, "tenants", input.tenantId, "members", input.uid, "actionCompletions", input.actionId), {
    actionId: input.actionId,
    tenantId: input.tenantId,
    completedAt,
  });
}

export function actionCompletionMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code.includes("permission-denied")) return "This account cannot complete that step.";
  if (code.includes("already-exists")) return "This step is already marked complete.";
  return "This step could not be saved.";
}
