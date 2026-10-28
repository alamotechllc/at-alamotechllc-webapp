import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function run(command: string, args: string[]): void {
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8280",
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9198",
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? "demo-raas-cp",
    },
  });
}

export default async function globalSetup(): Promise<void> {
  run("npm", ["run", "seed:tenant-zero"]);
  run("npm", ["run", "seed:tenant-poc-member"]);
  run("npm", ["run", "seed:operator", "--", "--ingest"]);
}
