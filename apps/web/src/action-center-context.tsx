import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildActionCenterView, type ActionCenterView } from "../../../packages/domain/src/actionCenter.js";
import { loadActionCompletions, loadCustomerActions } from "./action-center-data";
import { actionCompletionMessage, completeCustomerAction } from "./action-center-store";
import { useSession } from "./auth";
import { workspaceTenantId } from "./workspace";

interface ActionCenterContextValue {
  tenantId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  view: ActionCenterView | null;
  loading: boolean;
  error: string;
  reload: () => void;
  complete: (actionId: string) => Promise<void>;
  completingId: string | null;
}

const ActionCenterContext = createContext<ActionCenterContextValue | null>(null);

export function ActionCenterProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const tenantId = workspaceTenantId(session.role, session.tenantId);
  const uid = session.user?.uid ?? "";
  const enabled = session.access === "authorized" && Boolean(tenantId && uid);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actions, setActions] = useState<Awaited<ReturnType<typeof loadCustomerActions>>>([]);
  const [completions, setCompletions] = useState<Awaited<ReturnType<typeof loadActionCompletions>>>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setActions([]);
      setCompletions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([loadCustomerActions(tenantId, uid), loadActionCompletions(tenantId, uid)])
      .then(([nextActions, nextCompletions]) => {
        if (cancelled) return;
        setActions(nextActions);
        setCompletions(nextCompletions);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Next Steps could not be loaded.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, tenantId, uid, attempt]);

  const view = useMemo(() => {
    if (!enabled) return null;
    return buildActionCenterView(actions, completions, uid, tenantId);
  }, [actions, completions, enabled, tenantId, uid]);

  const complete = useCallback(
    async (actionId: string) => {
      if (!enabled) return;
      setCompletingId(actionId);
      setError("");
      try {
        await completeCustomerAction({ tenantId, uid, actionId });
        reload();
      } catch (caught) {
        setError(actionCompletionMessage(caught));
        throw caught;
      } finally {
        setCompletingId(null);
      }
    },
    [enabled, reload, tenantId, uid],
  );

  const value: ActionCenterContextValue = {
    tenantId,
    open,
    setOpen,
    view,
    loading,
    error,
    reload,
    complete,
    completingId,
  };

  return <ActionCenterContext.Provider value={value}>{children}</ActionCenterContext.Provider>;
}

export function useActionCenter(): ActionCenterContextValue {
  const value = useContext(ActionCenterContext);
  if (!value) throw new Error("ActionCenterProvider is required.");
  return value;
}
