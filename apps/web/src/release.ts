export const releaseChannel = import.meta.env.VITE_DEPLOY_CHANNEL || (import.meta.env.DEV ? "local" : "unknown");
export const releaseSha = import.meta.env.VITE_GIT_SHA || "unknown";
export const releaseBuiltAt = import.meta.env.VITE_BUILT_AT || "";

export function releaseLabel(): string {
  const sha = releaseSha === "unknown" ? "unknown" : releaseSha.slice(0, 7);
  return `${releaseChannel} · ${sha}`;
}
