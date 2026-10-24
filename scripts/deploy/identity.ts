/** Deploy targets for this repository. Emulator ids are never cloud targets. */

export const EMULATOR_PROJECT_ID = "demo-raas-cp";

/** Named by the product owner. The cloud project is not created by this repository. */
export const FIREBASE_PROJECT_ID = "at-alamotechllc-webapp";

export const HOSTING_PUBLIC = "apps/web/dist";
export const DEV_CHANNEL = "dev";
export const DEV_CHANNEL_EXPIRES = "30d";
export const PRODUCTION_PHRASE = "AUTHORIZE PRODUCTION DEPLOY";

export const CLOUD_RUN_SERVICES = ["raas-api", "raas-ingress", "ghl-adapter"] as const;

export type CloudRunService = (typeof CLOUD_RUN_SERVICES)[number];

export function cloudRunPhrase(service: CloudRunService): string {
  return `AUTHORIZE ${service.toUpperCase().replaceAll("-", " ")} DEV DEPLOY`;
}
