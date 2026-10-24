import { serve } from "@hono/node-server";
import { JsonLogger } from "@raas/logging";
import { firestore } from "@raas/store";
import { createIngressApp } from "./app.js";

const logger = new JsonLogger();
const app = createIngressApp({
  db: firestore(),
  logger,
  env: process.env,
});

const port = Number(process.env.INGRESS_PORT ?? 8092);
serve({ fetch: app.fetch, port }, () => {
  logger.write({ severity: "INFO", message: "raas-ingress listening", port });
});
