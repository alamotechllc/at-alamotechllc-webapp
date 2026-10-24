import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "raas-release-meta",
      transformIndexHtml(html) {
        const channel = process.env.VITE_DEPLOY_CHANNEL || (process.env.NODE_ENV === "production" ? "unknown" : "local");
        const sha = process.env.VITE_GIT_SHA || "unknown";
        const builtAt = process.env.VITE_BUILT_AT || "";
        return html
          .replaceAll("__RAAS_CHANNEL__", channel)
          .replaceAll("__RAAS_GIT_SHA__", sha)
          .replaceAll("__RAAS_BUILT_AT__", builtAt);
      },
    },
  ],
  esbuild: { jsx: "automatic" },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/v1": "http://127.0.0.1:8091",
      "/healthz": "http://127.0.0.1:8091",
    },
  },
});
