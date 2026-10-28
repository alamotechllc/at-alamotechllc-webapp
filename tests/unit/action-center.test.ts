import { describe, expect, it } from "vitest";
import {
  MAX_VISIBLE_ACTIONS,
  actionAppliesToUser,
  buildActionCenterView,
  computeActionProgress,
  filterApplicableActions,
  isAllowedActionUrl,
  selectVisiblePending,
  type ActionCompletion,
  type CustomerAction,
} from "@raas/domain";

const TENANT = "ten_a";
const UID = "user_a";
const OTHER = "user_b";

function action(overrides: Partial<CustomerAction> & Pick<CustomerAction, "id" | "priority">): CustomerAction {
  return {
    tenantId: TENANT,
    title: overrides.id,
    assignedTo: "all",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Action Center assignment", () => {
  it('shows "all", matching uid, and hides other uid or tenant', () => {
    const items = [
      action({ id: "a1", priority: 1, assignedTo: "all" }),
      action({ id: "a2", priority: 2, assignedTo: UID }),
      action({ id: "a3", priority: 3, assignedTo: OTHER }),
      action({ id: "a4", priority: 4, tenantId: "ten_other" }),
    ];
    const applicable = filterApplicableActions(items, UID, TENANT);
    expect(applicable.map((item) => item.id)).toEqual(["a1", "a2"]);
    expect(actionAppliesToUser(items[2], UID)).toBe(false);
  });
});

describe("Action Center limit", () => {
  const pending = Array.from({ length: 10 }, (_, index) => action({ id: `a${index}`, priority: index }));

  it("caps visible pending actions at MAX_VISIBLE_ACTIONS", () => {
    expect(selectVisiblePending([]).visible).toHaveLength(0);
    expect(selectVisiblePending(pending.slice(0, 1)).visible).toHaveLength(1);
    expect(selectVisiblePending(pending.slice(0, 3)).visible).toHaveLength(3);
    const four = selectVisiblePending(pending.slice(0, 4));
    expect(four.visible).toHaveLength(3);
    expect(four.additionalCount).toBe(1);
    const ten = selectVisiblePending(pending);
    expect(ten.visible).toHaveLength(MAX_VISIBLE_ACTIONS);
    expect(ten.additionalCount).toBe(7);
  });
});

describe("Action Center progress", () => {
  it("handles empty and partial totals safely", () => {
    expect(computeActionProgress(0, 0).caughtUp).toBe(true);
    expect(computeActionProgress(0, 0).percent).toBeNull();
    expect(computeActionProgress(0, 7).percent).toBe(0);
    expect(computeActionProgress(1, 7).percent).toBe(14);
    expect(computeActionProgress(3, 7).percent).toBe(43);
    expect(computeActionProgress(6, 7).percent).toBe(86);
    expect(computeActionProgress(7, 7).percent).toBe(100);
  });
});

describe("Action Center completion flow", () => {
  it("promotes the next pending action after completion", () => {
    const actions = [
      action({ id: "s1", priority: 1 }),
      action({ id: "s2", priority: 2 }),
      action({ id: "s3", priority: 3 }),
      action({ id: "s4", priority: 4 }),
    ];
    const completions: ActionCompletion[] = [];
    let view = buildActionCenterView(actions, completions, UID, TENANT);
    expect(view.selection.visible.map((item) => item.id)).toEqual(["s1", "s2", "s3"]);
    expect(view.selection.additionalCount).toBe(1);

    completions.push({ actionId: "s1", tenantId: TENANT, completedAt: "2026-01-02T00:00:00.000Z" });
    view = buildActionCenterView(actions, completions, UID, TENANT);
    expect(view.selection.visible.map((item) => item.id)).toEqual(["s2", "s3", "s4"]);
    expect(view.selection.visible).toHaveLength(3);
    expect(view.progress.completedCount).toBe(1);
  });
});

describe("Action Center URL safety", () => {
  it("blocks dangerous protocols and allows internal paths and https", () => {
    expect(isAllowedActionUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedActionUrl("data:text/html,hi")).toBe(false);
    expect(isAllowedActionUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedActionUrl("/results")).toBe(true);
    expect(isAllowedActionUrl("https://example.com/x")).toBe(true);
  });
});
