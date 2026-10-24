import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEV_CHANNEL,
  DEV_CHANNEL_EXPIRES,
  FIREBASE_PROJECT_ID,
} from "./deploy/identity.js";
import {
  cloudRunFailure,
  devGitFailure,
  hostingTargetFailure,
  isCloudRunService,
  productionPhraseFailure,
  productionPlanFailure,
  projectTargetFailure,
  webConfigFailure,
  type DevStamp,
  type GitSnapshot,
  type Stop,
} from "./deploy/guards.js";
import { scannable, scanText } from "./deploy/scan.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function stop(reason: Stop, extra: Record<string, string> = {}): never {
  console.error("DEPLOY STOPPED");
  console.error(`stage: ${reason.stage}`);
  console.error(reason.message);
  for (const [key, value] of Object.entries(extra)) console.error(`${key}: ${value}`);
  process.exit(1);
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function gitSnapshot(): GitSnapshot {
  let sha: string | null = null;
  try {
    sha = git(["rev-parse", "HEAD"]);
  } catch {
    sha = null;
  }
  const branch = sha ? git(["rev-parse", "--abbrev-ref", "HEAD"]) : "main";
  const dirty = git(["status", "--porcelain"]).length > 0;
  let hasOrigin = false;
  try {
    hasOrigin = git(["remote"]).split("\n").includes("origin");
  } catch {
    hasOrigin = false;
  }
  let diverged = false;
  let behind = false;
  if (sha && hasOrigin && branch === "dev") {
    try {
      git(["fetch", "origin", "dev"]);
      const counts = git(["rev-list", "--left-right", "--count", "HEAD...origin/dev"]).split(/\s+/);
      diverged = counts[0] !== "0" && counts[1] !== "0";
      behind = counts[0] === "0" && counts[1] !== "0";
    } catch {
      hasOrigin = false;
    }
  }
  return { branch, sha, dirty, hasOrigin, diverged, behind };
}

function readHostingPublic(): string | undefined {
  const config = JSON.parse(readFileSync(path.join(root, "firebase.json"), "utf8")) as {
    hosting?: { public?: string };
  };
  return config.hosting?.public;
}

function readStamp(): DevStamp | null {
  try {
    return JSON.parse(readFileSync(path.join(root, ".deploy", "last-dev.json"), "utf8")) as DevStamp;
  } catch {
    return null;
  }
}

function scanTree(): { file: string; rule: string }[] {
  const hits: { file: string; rule: string }[] = [];
  const listed = new Set<string>();
  for (const args of [["ls-files"], ["ls-files", "--others", "--exclude-standard"]] as const) {
    let names = "";
    try {
      names = git([...args]);
    } catch {
      names = "";
    }
    for (const name of names.split("\n").filter(Boolean)) listed.add(name);
  }
  for (const name of listed) {
    if (!scannable(name)) continue;
    const full = path.join(root, name);
    let info;
    try {
      info = statSync(full);
    } catch {
      continue;
    }
    if (!info.isFile() || info.size > 1_000_000) continue;
    hits.push(...scanText(name, readFileSync(full, "utf8")));
  }
  return hits;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): void {
  execFileSync(command, args, { cwd: root, stdio: "inherit", env });
}

function qualityGate(env: NodeJS.ProcessEnv): void {
  run("npm", ["run", "typecheck"], env);
  run("npm", ["run", "lint"], env);
  run("npm", ["run", "guard:frontend"], env);
  run("npm", ["run", "test:unit"], env);
  run("npm", ["run", "test:emulators"], env);
  run("npm", ["run", "build", "-w", "@raas/web"], env);
  const hits = scanTree();
  if (hits.length > 0) {
    stop({ stage: "scan", message: hits.map((hit) => `${hit.file} ${hit.rule}`).join("\n") });
  }
}

const PUBLIC_WEB_KEYS = [
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_API_BASE_URL",
] as const;

function readPublicWebFile(): Record<string, string> {
  let text = "";
  try {
    text = readFileSync(path.join(root, ".env"), "utf8");
  } catch {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const splitAt = trimmed.indexOf("=");
    const key = trimmed.slice(0, splitAt).trim();
    if (!PUBLIC_WEB_KEYS.includes(key as (typeof PUBLIC_WEB_KEYS)[number])) continue;
    values[key] = trimmed.slice(splitAt + 1).trim();
  }
  return values;
}

function releaseEnv(channel: "dev" | "production", sha: string): NodeJS.ProcessEnv {
  const file = readPublicWebFile();
  const web: Record<string, string> = {};
  for (const key of PUBLIC_WEB_KEYS) {
    const value = process.env[key] || file[key];
    if (value) web[key] = value;
  }
  return {
    ...process.env,
    ...web,
    VITE_USE_FIREBASE_EMULATORS: "false",
    VITE_DEPLOY_CHANNEL: channel,
    VITE_GIT_SHA: sha,
    VITE_BUILT_AT: new Date().toISOString(),
  };
}

function deployDevChannel(): string {
  const output = execFileSync(
    "npx",
    ["firebase", "--non-interactive", "--project", FIREBASE_PROJECT_ID, "hosting:channel:deploy", DEV_CHANNEL, "--expires", DEV_CHANNEL_EXPIRES],
    { cwd: root, encoding: "utf8" },
  );
  process.stdout.write(output);
  const url = output.match(/https:\/\/\S+/)?.[0];
  if (!url) stop({ stage: "firebase", message: "Firebase did not return a preview URL." });
  return url;
}

function commandDev(): void {
  const hosting = hostingTargetFailure(readHostingPublic());
  if (hosting) stop(hosting);
  const project = projectTargetFailure(FIREBASE_PROJECT_ID);
  if (project) stop(project);
  const snapshot = gitSnapshot();
  const gitStop = devGitFailure(snapshot);
  if (gitStop) stop(gitStop, { branch: snapshot.branch, sha: snapshot.sha ?? "" });
  const env = releaseEnv("dev", snapshot.sha!);
  const web = webConfigFailure(env);
  if (web) stop(web);
  qualityGate(env);
  run("git", ["push", "origin", "HEAD:dev"]);
  const url = deployDevChannel();
  mkdirSync(path.join(root, ".deploy"), { recursive: true });
  const stamp: DevStamp = {
    sha: snapshot.sha!,
    url,
    smoke: "not-automated",
    projectId: FIREBASE_PROJECT_ID,
  };
  writeFileSync(path.join(root, ".deploy", "last-dev.json"), `${JSON.stringify(stamp, null, 2)}\n`);
  stop({
    stage: "smoke",
    message: "Hosting may have been deployed. This repository has no hosted smoke suite, so the DEV stamp is not a pass and production stays closed.",
  });
}

function commandProd(authorize: string | undefined, sha: string | undefined): void {
  const snapshot = gitSnapshot();
  if (!authorize) {
    console.log("PRODUCTION PREPARE");
    console.log(`branch: ${snapshot.branch}`);
    console.log(`sha: ${snapshot.sha ?? ""}`);
    console.log(`project: ${FIREBASE_PROJECT_ID}`);
    console.log("resources: hosting");
    console.log("This command does not merge, push main, or deploy.");
    console.log(`Authorize with: npm run deploy:prod -- --authorize "${PRODUCTION_READY}" --sha <full-sha>`);
    return;
  }
  const phrase = productionPhraseFailure(authorize);
  if (phrase) stop(phrase);
  const plan = productionPlanFailure({
    approvedSha: sha,
    headSha: snapshot.sha,
    branch: snapshot.branch,
    stamp: readStamp(),
  });
  if (plan) stop(plan, { branch: snapshot.branch, sha: snapshot.sha ?? "" });
  git(["checkout", "main"]);
  git(["merge", "--ff-only", sha!]);
  const mainSha = git(["rev-parse", "HEAD"]);
  if (mainSha !== sha) {
    stop({ stage: "git", message: "main does not match the approved SHA. Firebase was not changed." });
  }
  run("git", ["push", "origin", "main"]);
  const env = releaseEnv("production", mainSha);
  const web = webConfigFailure(env);
  if (web) stop(web);
  run("npm", ["run", "build", "-w", "@raas/web"], env);
  const output = execFileSync(
    "npx",
    ["firebase", "--non-interactive", "--project", FIREBASE_PROJECT_ID, "deploy", "--only", "hosting"],
    { cwd: root, encoding: "utf8" },
  );
  process.stdout.write(output);
  console.log(`production sha: ${mainSha}`);
  console.log(`project: ${FIREBASE_PROJECT_ID}`);
}

const PRODUCTION_READY = "AUTHORIZE PRODUCTION DEPLOY";

function commandRules(authorize: string | undefined, sha: string | undefined): void {
  const phrase = productionPhraseFailure(authorize);
  if (phrase) stop(phrase);
  const snapshot = gitSnapshot();
  if (snapshot.branch !== "main" || !snapshot.sha || snapshot.sha !== sha) {
    stop({ stage: "rules", message: "Rules deploy runs only on main for the authorized SHA." }, { branch: snapshot.branch });
  }
  stop({
    stage: "rules",
    message: "Firestore rules are project-wide. They are not deployed until a confirmed Firebase project exists and this command is implemented against that project.",
  });
}

function commandScan(): void {
  const hits = scanTree();
  if (hits.length > 0) {
    stop({ stage: "scan", message: hits.map((hit) => `${hit.file} ${hit.rule}`).join("\n") });
  }
  console.log("scan: no findings");
}

function commandCloudRun(service: string, authorize: string | undefined, sha: string | undefined): void {
  if (!isCloudRunService(service)) stop(cloudRunFailure(service));
  if (!authorize?.includes(service.toUpperCase().replaceAll("-", " ")) || !sha) {
    stop({
      stage: "cloud-run",
      message: `Cloud Run ${service} requires its own authorization phrase and the full SHA. Hosting authorization does not cover it.`,
    });
  }
  stop(cloudRunFailure(service));
}

function main(): void {
  const [command = "", service = ""] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const authorize = readFlag("--authorize");
  const sha = readFlag("--sha");
  if (command === "dev") commandDev();
  else if (command === "prod") commandProd(authorize, sha);
  else if (command === "rules") commandRules(authorize, sha);
  else if (command === "scan") commandScan();
  else if (command === "cloud-run") commandCloudRun(service, authorize, sha);
  else {
    stop({ stage: "usage", message: "Use dev, prod, rules, scan, or cloud-run <raas-api|raas-ingress|ghl-adapter>." });
  }
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
