export interface SeedEnv {
  FIRESTORE_EMULATOR_HOST?: string;
  FIREBASE_PROJECT_ID?: string;
}

/** Development seed only. Production is never seeded by this process. */
export function assertDevelopmentSeedAllowed(env: SeedEnv): void {
  if (!env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Refusing to seed: FIRESTORE_EMULATOR_HOST is not set. Production is not seeded.");
  }
  const project = env.FIREBASE_PROJECT_ID ?? "demo-raas-cp";
  if (!project.startsWith("demo-")) {
    throw new Error("Refusing to seed: FIREBASE_PROJECT_ID must be a demo emulator project.");
  }
}
