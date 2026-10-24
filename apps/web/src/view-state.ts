export interface FailureProbe {
  status: "loading" | "ready" | "failed";
  failure?: string;
  message?: string;
}

export function sharedFailure(states: FailureProbe[]): { failure: string; message: string } | null {
  if (states.length === 0 || states.some((state) => state.status === "loading")) return null;
  const failed = states.filter((state) => state.status === "failed");
  if (failed.length < 2) return null;
  const failure = failed[0]?.failure;
  const message = failed[0]?.message;
  if (!failure || message === undefined) return null;
  if (!failed.every((state) => state.failure === failure && state.message === message)) return null;
  return { failure, message };
}

export function noticeCopy(failure: string, message: string): { title: string; detail: string } {
  if (failure === "unauthorized") {
    return {
      title: "Unauthorized",
      detail: message || "This account cannot view this Lead Capture data.",
    };
  }
  const generic = !message || message === "Unexpected error." || message === "The request failed.";
  if (failure === "unavailable" || generic) {
    return {
      title: "RaaS API unavailable",
      detail: "We couldn't retrieve current Lead Capture results.",
    };
  }
  return {
    title: "Lead Capture data is unavailable",
    detail: message,
  };
}

export function unavailableLabel(failure: string): string {
  return failure === "unauthorized" ? "Unauthorized" : "Unavailable";
}

export function retryAll(states: Array<{ retry: () => void }>): void {
  for (const state of states) state.retry();
}
