import { describe, expect, it } from "vitest";
import { FIREBASE_PROJECT_ID, HOSTING_PUBLIC, PRODUCTION_PHRASE } from "../../scripts/deploy/identity.js";
import {
  devGitFailure,
  hostingTargetFailure,
  productionPhraseFailure,
  productionPlanFailure,
  projectTargetFailure,
  webConfigFailure,
  type GitSnapshot,
} from "../../scripts/deploy/guards.js";
import { scanText } from "../../scripts/deploy/scan.js";

const cleanDev: GitSnapshot = {
  branch: "dev",
  sha: "a".repeat(40),
  dirty: false,
  hasOrigin: true,
  diverged: false,
  behind: false,
};

const webEnv = {
  VITE_FIREBASE_PROJECT_ID: FIREBASE_PROJECT_ID,
  VITE_FIREBASE_API_KEY: "AIzaSyPublicExampleKey0123456789",
  VITE_FIREBASE_AUTH_DOMAIN: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
};

describe("deploy guards", () => {
  it("keeps the emulator project off the cloud path", () => {
    expect(projectTargetFailure("demo-raas-cp")?.stage).toBe("project");
    expect(projectTargetFailure(FIREBASE_PROJECT_ID)).toBeNull();
    expect(hostingTargetFailure(HOSTING_PUBLIC)).toBeNull();
    expect(hostingTargetFailure("public")?.stage).toBe("hosting");
  });

  it("requires a clean dev branch and a non-emulator web config", () => {
    expect(devGitFailure(cleanDev)).toBeNull();
    expect(devGitFailure({ ...cleanDev, sha: null })?.message).toMatch(/commit/);
    expect(devGitFailure({ ...cleanDev, branch: "main" })?.message).toMatch(/dev/);
    expect(devGitFailure({ ...cleanDev, dirty: true })?.stage).toBe("git");
    expect(webConfigFailure(webEnv)).toBeNull();
    expect(webConfigFailure({ ...webEnv, VITE_USE_FIREBASE_EMULATORS: "true" })?.stage).toBe("web-config");
    expect(webConfigFailure({ ...webEnv, VITE_FIREBASE_PROJECT_ID: "demo-raas-cp" })?.stage).toBe("web-config");
    expect(webConfigFailure({ ...webEnv, VITE_FIREBASE_API_KEY: "not-a-web-key" })?.message).toMatch(/apiKey/);
    expect(webConfigFailure({ ...webEnv, VITE_FIREBASE_AUTH_DOMAIN: `https://${FIREBASE_PROJECT_ID}.firebaseapp.com` })?.message).toMatch(/host/);
  });

  it("accepts only the production phrase for the stamped commit", () => {
    expect(productionPhraseFailure("deploy")?.stage).toBe("authorization");
    expect(productionPhraseFailure(`  ${PRODUCTION_PHRASE}  `)).toBeNull();
    const stamp = { sha: cleanDev.sha!, url: "https://example.web.app", smoke: "pass" as const, projectId: FIREBASE_PROJECT_ID };
    expect(productionPlanFailure({
      approvedSha: cleanDev.sha!,
      headSha: cleanDev.sha,
      branch: "dev",
      stamp,
    })).toBeNull();
    expect(productionPlanFailure({
      approvedSha: cleanDev.sha!,
      headSha: cleanDev.sha,
      branch: "dev",
      stamp: { ...stamp, smoke: "not-automated" },
    })?.stage).toBe("dev-stamp");
  });

  it("reports secret material without copying the value into the rule id", () => {
    const pem = `-----BEGIN ${"PRIVATE"} KEY-----\nabc`;
    const token = `GHL_${"PRIVATE"}_INTEGRATION_TOKEN=pit-secret`;
    expect(scanText("key.pem", pem)).toEqual([{ file: "key.pem", rule: "private-key" }]);
    expect(scanText(".env.example", "LOCAL_INGRESS_TOKEN=local-dev-only-change-me")).toEqual([]);
    expect(scanText(".env", token)).toEqual([{ file: ".env", rule: "ghl-private-token" }]);
  });
});
