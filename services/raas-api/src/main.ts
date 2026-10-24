import { serve } from "@hono/node-server";
import { JsonLogger } from "@raas/logging";
import { FileSecretStore } from "@raas/secrets";
import { firestore, projectId } from "@raas/store";
import { createApiApp } from "./app.js";
import { callerFromAuthorization } from "./identity.js";

const logger = new JsonLogger();
const firebaseProjectId = projectId();
const app = createApiApp({
  db: firestore(),
  logger,
  projectId: firebaseProjectId,
  secrets: new FileSecretStore(firebaseProjectId, process.env.SECRETS_DIR ?? ".local/secrets"),
  verifyUser: callerFromAuthorization,
});

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 8091);
serve({ fetch: app.fetch, port }, () => {
  logger.write({ severity: "INFO", message: "raas-api listening", port });
});
