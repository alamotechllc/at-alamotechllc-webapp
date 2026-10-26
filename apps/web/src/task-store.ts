import { doc, setDoc, updateDoc } from "firebase/firestore";
import { clientDb } from "./auth";
import { taskDraft, type TaskDraft } from "./tasks";

function taskId(): string {
  return `tsk_${crypto.randomUUID().replace(/-/g, "")}`;
}

export async function createTask(input: {
  tenantId: string;
  uid: string;
  title: string;
  detail: string;
  dueOn: string;
}): Promise<void> {
  const draft: TaskDraft | null = taskDraft(input);
  if (!clientDb || !draft) throw new Error("The task could not be saved.");
  const id = taskId();
  const createdAt = new Date().toISOString();
  await setDoc(doc(clientDb, "tenants", input.tenantId, "tasks", id), {
    taskId: id,
    tenantId: input.tenantId,
    title: draft.title,
    detail: draft.detail,
    dueOn: draft.dueOn,
    status: "open",
    createdAt,
    createdByUid: input.uid,
    completedAt: null,
  });
}

export async function setTaskStatus(input: {
  tenantId: string;
  taskId: string;
  status: "open" | "done";
}): Promise<void> {
  if (!clientDb) throw new Error("The task could not be saved.");
  await updateDoc(doc(clientDb, "tenants", input.tenantId, "tasks", input.taskId), {
    status: input.status,
    completedAt: input.status === "done" ? new Date().toISOString() : null,
  });
}
