import { describe, expect, it } from "vitest";
import { formatTaskDue, orderTasks, taskDraft, type TaskRecord } from "../../apps/web/src/tasks.js";

function task(partial: Partial<TaskRecord> & Pick<TaskRecord, "taskId" | "status">): TaskRecord {
  return {
    title: partial.taskId,
    detail: "",
    dueOn: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
    ...partial,
  };
}

describe("tasks", () => {
  it("keeps a title and an optional due date", () => {
    expect(taskDraft({ title: "  Call back  ", detail: "  ", dueOn: "2026-10-30" })).toEqual({
      title: "Call back",
      detail: "",
      dueOn: "2026-10-30",
    });
    expect(taskDraft({ title: "   ", detail: "", dueOn: "" })).toBeNull();
    expect(taskDraft({ title: "Call", detail: "", dueOn: "October 30" })).toBeNull();
  });

  it("orders open tasks by due date and keeps completed tasks after them", () => {
    const ordered = orderTasks([
      task({ taskId: "done", status: "done", completedAt: "2026-10-02T00:00:00.000Z" }),
      task({ taskId: "later", status: "open", dueOn: "2026-11-01", createdAt: "2026-10-02T00:00:00.000Z" }),
      task({ taskId: "none", status: "open", createdAt: "2026-10-03T00:00:00.000Z" }),
      task({ taskId: "soon", status: "open", dueOn: "2026-10-20", createdAt: "2026-10-01T00:00:00.000Z" }),
    ]);
    expect(ordered.map((item) => item.taskId)).toEqual(["soon", "later", "none", "done"]);
    expect(formatTaskDue("2026-10-26")).toBe("Oct 26, 2026");
  });
});
