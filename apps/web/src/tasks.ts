export interface TaskRecord {
  taskId: string;
  title: string;
  detail: string;
  status: string;
  dueOn: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TaskDraft {
  title: string;
  detail: string;
  dueOn: string | null;
}

const DUE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export function taskDraft(input: { title: string; detail: string; dueOn: string }): TaskDraft | null {
  const title = input.title.trim();
  const detail = input.detail.trim();
  const dueOn = input.dueOn.trim();
  if (!title || title.length > 200 || detail.length > 1000) return null;
  if (dueOn && !DUE.test(dueOn)) return null;
  return { title, detail, dueOn: dueOn || null };
}

export function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatTaskDue(value: string): string {
  const match = DUE.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))));
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function orderTasks(tasks: TaskRecord[]): TaskRecord[] {
  return [...tasks].sort((a, b) => {
    const aOpen = a.status === "open";
    const bOpen = b.status === "open";
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    if (aOpen) {
      const due = (a.dueOn ?? "9999-99-99").localeCompare(b.dueOn ?? "9999-99-99");
      if (due !== 0) return due;
      return b.createdAt.localeCompare(a.createdAt);
    }
    return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
  });
}

export function taskWriteMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code.includes("permission-denied")) return "This account cannot change tasks.";
  if (code.includes("unavailable") || code.includes("deadline-exceeded") || code.includes("network-request-failed")) {
    return "The data service did not respond.";
  }
  return "The task could not be saved.";
}
