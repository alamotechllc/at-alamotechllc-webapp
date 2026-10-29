import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "tests/visual",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "off",
  },
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : {
        command: "npm run dev:web",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          VITE_USE_FIREBASE_EMULATORS: "true",
          VITE_FIREBASE_PROJECT_ID: "demo-raas-cp",
          VITE_FIREBASE_AUTH_EMULATOR_HOST: process.env.VITE_FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9198",
          VITE_FIRESTORE_EMULATOR_HOST: process.env.VITE_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8280",
        },
      },
  projects: [
    {
      name: "reference-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "reference-phone",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
});
