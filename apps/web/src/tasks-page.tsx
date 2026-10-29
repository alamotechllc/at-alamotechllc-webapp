import { Link } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { hasPermission } from "../../../packages/domain/src/rbac";
import { TENANT_ZERO } from "../../../packages/domain/src/tenantZero.js";
import { trackTaskCompleted, trackTaskCreated, trackTaskReopened } from "./analytics";
import { useSession } from "./auth";
import { Button } from "./components/ui/button";
import { AppCard } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { PageShell } from "./components/layout/page-shell";
import { EmptyState, ErrorState, LoadingState, SectionHeader } from "./components/ui/states";
import { useApi } from "./data";
import { createTask, setTaskStatus } from "./task-store";
import { formatTaskDue, localToday, orderTasks, taskWriteMessage, type TaskRecord } from "./tasks";

function useWorkspaceTenantId(): string {
  const session = useSession();
  if (session.role === "tenant_admin" || session.role === "tenant_viewer") return session.tenantId ?? "";
  return TENANT_ZERO.tenantId;
}

function TaskRow({
  task,
  today,
  canWrite,
  pending,
  onStatus,
}: {
  task: TaskRecord;
  today: string;
  canWrite: boolean;
  pending: boolean;
  onStatus: (task: TaskRecord, status: "open" | "done") => void;
}) {
  const open = task.status === "open";
  const overdue = open && task.dueOn !== null && task.dueOn < today;
  return (
    <li className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="break-words font-medium text-foreground">{task.title}</p>
        {task.detail ? <p className="mt-1 break-words text-sm text-foreground-muted">{task.detail}</p> : null}
        <p className="mt-2 text-sm text-foreground-muted">
          {open && task.dueOn ? <span>{overdue ? "Overdue" : "Due"} {formatTaskDue(task.dueOn)}</span> : null}
          {open && !task.dueOn ? <span>No due date</span> : null}
          {!open ? <span>Completed</span> : null}
        </p>
      </div>
      {canWrite ? (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={pending}
          onClick={() => onStatus(task, open ? "done" : "open")}
        >
          {pending ? "Saving…" : open ? "Mark done" : "Reopen"}
        </Button>
      ) : null}
    </li>
  );
}

export function OpenTasks({ tenantId }: { tenantId: string }) {
  const tasks = useApi<{ items: TaskRecord[] }>(tenantId ? `/v1/tenants/${tenantId}/tasks` : null);
  const today = localToday();
  const open = tasks.status === "ready"
    ? orderTasks(tasks.data.items).filter((item) => item.status === "open").slice(0, 5)
    : [];
  return (
    <section aria-labelledby="open-tasks" className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="open-tasks" className="text-xs font-medium text-foreground-muted">Tasks</h2>
          <p className="text-sm text-foreground-muted">Work your team tracks, not Next Steps.</p>
        </div>
        <Link className="shrink-0 text-sm font-medium text-accent underline-offset-4 hover:underline" to="/tasks">All tasks</Link>
      </div>
      <AppCard className="border-l-4 border-l-muted-foreground/30 p-4 shadow-none">
        {tasks.status === "loading" ? <LoadingState label="Loading tasks" compact /> : null}
        {tasks.status === "failed" ? <ErrorState failure={tasks.failure} message={tasks.message} onRetry={tasks.retry} /> : null}
        {tasks.status === "ready" && open.length === 0 ? (
          <EmptyState title="No open tasks" detail="Add a task when something needs a person to do it." />
        ) : null}
        {open.length > 0 ? (
          <ul>
            {open.map((task) => (
              <li key={task.taskId} className="border-b border-border py-3 last:border-b-0">
                <p className="break-words font-medium">{task.title}</p>
                <p className="mt-1 text-sm text-foreground-muted">
                  {task.dueOn ? `${task.dueOn < today ? "Overdue" : "Due"} ${formatTaskDue(task.dueOn)}` : "No due date"}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </AppCard>
    </section>
  );
}

export function TasksPage() {
  const session = useSession();
  const tenantId = useWorkspaceTenantId();
  const tasks = useApi<{ items: TaskRecord[] }>(tenantId ? `/v1/tenants/${tenantId}/tasks` : null);
  const canWrite = hasPermission(session.role ?? undefined, "task.write");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const today = localToday();
  const ordered = tasks.status === "ready" ? orderTasks(tasks.data.items) : [];
  const open = ordered.filter((item) => item.status === "open");
  const done = ordered.filter((item) => item.status === "done");

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.user || !tenantId) return;
    setPending(true);
    setFormError("");
    try {
      await createTask({ tenantId, uid: session.user.uid, title, detail, dueOn });
      trackTaskCreated();
      setTitle("");
      setDetail("");
      setDueOn("");
      tasks.reload();
    } catch (error) {
      setFormError(taskWriteMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function onStatus(task: TaskRecord, status: "open" | "done") {
    if (!tenantId) return;
    setPending(true);
    setFormError("");
    try {
      await setTaskStatus({ tenantId, taskId: task.taskId, status });
      if (status === "done") trackTaskCompleted();
      else trackTaskReopened();
      tasks.reload();
    } catch (error) {
      setFormError(taskWriteMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell className="flex flex-col gap-6">
      <SectionHeader
        title="Tasks"
        detail="Work that still needs a person on your team. This is separate from Next Steps, which are items Alamo Tech needs from you."
      />
      {canWrite ? (
        <AppCard className="p-4 md:p-6">
          <form className="grid gap-3" onSubmit={(event) => void onCreate(event)}>
            <label className="grid gap-1 text-sm font-medium">
              Task
              <Input value={title} maxLength={200} required onChange={(event) => setTitle(event.target.value)} placeholder="What needs to be done" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Note
              <textarea
                value={detail}
                maxLength={1000}
                onChange={(event) => setDetail(event.target.value)}
                placeholder="Optional"
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium sm:max-w-xs">
              Due date
              <Input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
            </label>
            {formError ? <p role="alert" className="text-sm text-error-foreground">{formError}</p> : null}
            <div>
              <Button type="submit" disabled={pending || title.trim().length === 0}>Add task</Button>
            </div>
          </form>
        </AppCard>
      ) : null}
      {!canWrite && formError ? <p role="alert" className="text-sm text-error-foreground">{formError}</p> : null}
      {tasks.status === "loading" ? <LoadingState label="Loading tasks" /> : null}
      {tasks.status === "failed" ? <ErrorState failure={tasks.failure} message={tasks.message} onRetry={tasks.retry} /> : null}
      {tasks.status === "ready" && open.length === 0 ? (
        <AppCard className="p-4">
          <EmptyState title="No open tasks" detail="Open tasks stay at the top of this list." />
        </AppCard>
      ) : null}
      {open.length > 0 ? (
        <AppCard className="px-4">
          <ul>
            {open.map((task) => (
              <TaskRow key={task.taskId} task={task} today={today} canWrite={canWrite} pending={pending} onStatus={(item, status) => void onStatus(item, status)} />
            ))}
          </ul>
        </AppCard>
      ) : null}
      {done.length > 0 ? (
        <section aria-labelledby="completed-tasks" className="space-y-3">
          <h2 id="completed-tasks" className="text-sm font-semibold text-foreground-muted">Completed</h2>
          <AppCard className="px-4">
            <ul>
              {done.map((task) => (
                <TaskRow key={task.taskId} task={task} today={today} canWrite={canWrite} pending={pending} onStatus={(item, status) => void onStatus(item, status)} />
              ))}
            </ul>
          </AppCard>
        </section>
      ) : null}
    </PageShell>
  );
}
