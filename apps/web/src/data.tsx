import { useCallback, useEffect, useState } from "react";
import { apiGet, ApiRequestError } from "./api";
import { useSession } from "./auth";
import type { ViewFailure } from "./metrics";

type Payload<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "failed"; failure: ViewFailure; message: string };

export type LoadState<T> = Payload<T> & { retry: () => void };

export function useApi<T>(path: string | null | undefined): LoadState<T> {
  const session = useSession();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Payload<T>>({ status: "loading" });
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!session.ready || session.access !== "authorized" || !session.user || !path) return;
    let cancelled = false;
    setState({ status: "loading" });
    session.token()
      .then((token) => apiGet<T>(path, token))
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError) {
          setState({ status: "failed", failure: error.failure, message: error.message });
          return;
        }
        setState({ status: "failed", failure: "unavailable", message: "The API is unavailable." });
      });
    return () => {
      cancelled = true;
    };
  }, [session, path, attempt]);

  if (path === undefined) return { status: "loading", retry };
  if (path === null) return { status: "failed", failure: "error", message: "This client is not available.", retry };
  if (!session.ready || (session.access === "authorized" && state.status === "loading")) return { status: "loading", retry };
  if (session.access !== "authorized" || !session.user) {
    return { status: "failed", failure: "unauthorized", message: "Sign-in is required.", retry };
  }
  return { ...state, retry };
}
