/** Platform Action Center (user-facing: Next Steps). */

export const MAX_VISIBLE_ACTIONS = 3;

export interface CustomerAction {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  assignedTo: "all" | string;
  priority: number;
  actionLabel?: string;
  actionUrl?: string;
  createdAt: string;
}

export interface ActionCompletion {
  actionId: string;
  tenantId: string;
  completedAt: string;
}

export interface ActionCenterProgress {
  percent: number | null;
  completedCount: number;
  totalCount: number;
  caughtUp: boolean;
  label: string;
  detail: string;
}

export interface ActionCenterSelection {
  visible: CustomerAction[];
  additionalCount: number;
  visibleCount: number;
}

export interface ActionCenterView {
  progress: ActionCenterProgress;
  selection: ActionCenterSelection;
  completed: CustomerAction[];
  pending: CustomerAction[];
}

export function actionAppliesToUser(action: CustomerAction, uid: string): boolean {
  return action.assignedTo === "all" || action.assignedTo === uid;
}

export function filterApplicableActions(actions: CustomerAction[], uid: string, tenantId: string): CustomerAction[] {
  return actions.filter((action) => action.tenantId === tenantId && actionAppliesToUser(action, uid));
}

export function completionMap(completions: ActionCompletion[]): Map<string, ActionCompletion> {
  return new Map(completions.map((item) => [item.actionId, item]));
}

export function isActionCompleted(actionId: string, completions: Map<string, ActionCompletion>): boolean {
  return completions.has(actionId);
}

export function sortActionsByPriority(actions: CustomerAction[]): CustomerAction[] {
  return [...actions].sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function splitPendingCompleted(
  applicable: CustomerAction[],
  completions: Map<string, ActionCompletion>,
): { pending: CustomerAction[]; completed: CustomerAction[] } {
  const pending: CustomerAction[] = [];
  const completed: CustomerAction[] = [];
  for (const action of sortActionsByPriority(applicable)) {
    if (isActionCompleted(action.id, completions)) completed.push(action);
    else pending.push(action);
  }
  return { pending, completed };
}

export function selectVisiblePending(pending: CustomerAction[], maxVisible = MAX_VISIBLE_ACTIONS): ActionCenterSelection {
  const visible = pending.slice(0, maxVisible);
  const additionalCount = Math.max(0, pending.length - visible.length);
  return { visible, additionalCount, visibleCount: visible.length };
}

export function computeActionProgress(completedCount: number, totalCount: number): ActionCenterProgress {
  if (totalCount === 0) {
    return {
      percent: null,
      completedCount: 0,
      totalCount: 0,
      caughtUp: true,
      label: "You're all caught up",
      detail: "No next steps are assigned right now.",
    };
  }
  const percent = Math.min(100, Math.max(0, Math.round((completedCount / totalCount) * 100)));
  const caughtUp = pendingWouldBeEmpty(completedCount, totalCount);
  return {
    percent,
    completedCount,
    totalCount,
    caughtUp,
    label: caughtUp && completedCount === totalCount ? `${percent}%` : `${percent}%`,
    detail: `${completedCount} of ${totalCount} completed`,
  };
}

function pendingWouldBeEmpty(completedCount: number, totalCount: number): boolean {
  return completedCount >= totalCount;
}

export function buildActionCenterView(
  actions: CustomerAction[],
  completions: ActionCompletion[],
  uid: string,
  tenantId: string,
): ActionCenterView {
  const applicable = filterApplicableActions(actions, uid, tenantId);
  const map = completionMap(completions);
  const { pending, completed } = splitPendingCompleted(applicable, map);
  const progress = computeActionProgress(completed.length, applicable.length);
  const selection = selectVisiblePending(pending);
  return { progress, selection, completed, pending };
}

const BLOCKED_URL_PROTOCOLS = ["javascript:", "data:", "file:"];

/** Validates optional action CTAs in the browser and in rules-aligned tests. */
export function isAllowedActionUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (BLOCKED_URL_PROTOCOLS.some((prefix) => lower.startsWith(prefix))) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") return true;
    if (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function safeActionUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return isAllowedActionUrl(url) ? url.trim() : undefined;
}
