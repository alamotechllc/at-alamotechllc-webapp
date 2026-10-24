import { serve } from "@hono/node-server";
import { JsonLogger } from "@raas/logging";
import { FileSecretStore } from "@raas/secrets";
import { createGhlAdapterApp } from "./app.js";
import { createHttpIngressClient } from "./ingressClient.js";

const logger = new JsonLogger();
const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-raas-cp";
const secrets = new FileSecretStore(projectId, process.env.SECRETS_DIR ?? ".local/secrets");
const origin = process.env.INGRESS_URL ?? "http://127.0.0.1:8092";
const token = process.env.LOCAL_INGRESS_TOKEN ?? "";
const app = createGhlAdapterApp({
  logger,
  secrets,
  ingress: createHttpIngressClient({
    fetchImpl: fetch,
    origin,
    authorization: `Bearer ${token}`,
  }),
});

const port = Number(process.env.GHL_ADAPTER_PORT ?? 8093);
serve({ fetch: app.fetch, port }, () => {
  logger.write({ severity: "INFO", message: "ghl-adapter listening", port });
});
