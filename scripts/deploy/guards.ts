import {
  CLOUD_RUN_SERVICES,
  EMULATOR_PROJECT_ID,
  FIREBASE_PROJECT_ID,
  HOSTING_PUBLIC,
  PRODUCTION_PHRASE,
  type CloudRunService,
} from "./identity.js";

export interface GitSnapshot {
  branch: string;
  sha: string | null;
  dirty: boolean;
  hasOrigin: boolean;
  diverged: boolean;
  behind: boolean;
}

export interface DevStamp {
  sha: string;
  url: string;
  smoke: "pass" | "fail" | "not-automated";
  projectId: string;
}

export interface Stop {
  stage: string;
  message: string;
}

export function hostingTargetFailure(publicDir: string | undefined): Stop | null {
  if (publicDir !== HOSTING_PUBLIC) {
    return { stage: "hosting", message: `Hosting public directory must be ${HOSTING_PUBLIC}.` };
  }
  return null;
}

export function projectTargetFailure(projectId: string): Stop | null {
  if (projectId === EMULATOR_PROJECT_ID) {
    return { stage: "project", message: `${EMULATOR_PROJECT_ID} is an emulator id and cannot be deployed.` };
  }
  if (projectId !== FIREBASE_PROJECT_ID) {
    return { stage: "project", message: `Firebase project must be ${FIREBASE_PROJECT_ID}.` };
  }
  return null;
}

export function webConfigFailure(env: Record<string, string | undefined>): Stop | null {
  if (env.VITE_USE_FIREBASE_EMULATORS === "true") {
    return { stage: "web-config", message: "A release build cannot connect to the Auth emulator." };
  }
  if (env.VITE_FIREBASE_PROJECT_ID !== FIREBASE_PROJECT_ID) {
    return { stage: "web-config", message: `VITE_FIREBASE_PROJECT_ID must be ${FIREBASE_PROJECT_ID}.` };
  }
  if (!env.VITE_FIREBASE_API_KEY?.startsWith("AIza")) {
    return { stage: "web-config", message: "VITE_FIREBASE_API_KEY must be the Firebase web apiKey." };
  }
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN ?? "";
  if (!authDomain || authDomain.includes("://") || authDomain.includes("/")) {
    return { stage: "web-config", message: "VITE_FIREBASE_AUTH_DOMAIN must be the Firebase auth host, without https://." };
  }
  const api = env.VITE_API_BASE_URL ?? "";
  if (!api.startsWith("https://")) {
    return { stage: "web-config", message: "VITE_API_BASE_URL must be the HTTPS origin of raas-api." };
  }
  return null;
}

export function devGitFailure(git: GitSnapshot): Stop | null {
  if (!git.sha) return { stage: "git", message: "DEV deploy needs a commit. This repository has none." };
  if (git.branch !== "dev") return { stage: "git", message: "DEV deploy must run from branch dev." };
  if (git.dirty) return { stage: "git", message: "Commit or stash changes before a DEV deploy." };
  if (!git.hasOrigin) return { stage: "git", message: "DEV deploy needs an origin remote." };
  if (git.diverged) return { stage: "git", message: "dev has diverged from origin/dev. Resolve it without a force push." };
  if (git.behind) return { stage: "git", message: "dev is behind origin/dev. Pull before deploying." };
  return null;
}

export function productionPhraseFailure(phrase: string | undefined): Stop | null {
  if (phrase?.trim() !== PRODUCTION_PHRASE) {
    return {
      stage: "authorization",
      message: `Production deploy requires the exact phrase ${PRODUCTION_PHRASE} and the full commit SHA.`,
    };
  }
  return null;
}

export function productionPlanFailure(input: {
  approvedSha: string | undefined;
  headSha: string | null;
  branch: string;
  stamp: DevStamp | null;
}): Stop | null {
  if (!input.headSha) return { stage: "git", message: "Production deploy needs a commit." };
  if (input.branch !== "dev") return { stage: "git", message: "Production promotion starts from a clean dev branch." };
  if (!input.approvedSha || input.approvedSha !== input.headSha) {
    return { stage: "authorization", message: "The approved SHA is not the commit about to be released." };
  }
  if (!input.stamp || input.stamp.sha !== input.headSha || input.stamp.projectId !== FIREBASE_PROJECT_ID) {
    return { stage: "dev-stamp", message: "A DEV deploy stamp for this commit is missing." };
  }
  if (input.stamp.smoke !== "pass") {
    return { stage: "dev-stamp", message: "DEV smoke did not pass for this commit." };
  }
  return null;
}

export function cloudRunFailure(service: string): Stop {
  const known = (CLOUD_RUN_SERVICES as readonly string[]).includes(service);
  if (!known) {
    return { stage: "cloud-run", message: `${service} is not a Lead Capture runtime.` };
  }
  return {
    stage: "cloud-run",
    message: `${service} has no container in this repository. Cloud Run deploy is a separate authorization and is not run from Hosting.`,
  };
}

export function isCloudRunService(service: string): service is CloudRunService {
  return (CLOUD_RUN_SERVICES as readonly string[]).includes(service);
}
