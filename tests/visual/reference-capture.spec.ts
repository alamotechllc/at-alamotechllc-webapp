import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { signInWithEmulatorForm, tenantCredentials } from "../e2e/helpers.js";

const outDir = path.resolve(
  process.env.REFERENCE_SCREEN_DIR ?? "evidence/reference-screens",
);

function shot(name: string): string {
  return path.join(outDir, name);
}

test.beforeAll(() => {
  fs.mkdirSync(outDir, { recursive: true });
});

test.describe("reference visual archive", () => {
  test.beforeEach(async ({ page }) => {
    await signInWithEmulatorForm(page, tenantCredentials.email, tenantCredentials.password);
    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  });

  test("command center home", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "reference-desktop", "desktop only");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Status", level: 2 })).toBeVisible();
    await page.screenshot({ path: shot("command-center-desktop.png"), fullPage: true });
  });

  test("command center home phone", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "reference-phone", "phone only");
    await page.goto("/");
    await expect(page.getByText(/things need your attention|all caught up/i)).toBeVisible();
    await page.screenshot({ path: shot("command-center-phone.png"), fullPage: true });
  });

  test("next steps drawer", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "reference-desktop", "desktop only");
    await page.goto("/");
    await page.getByRole("button", { name: /View all next steps/i }).click();
    await expect(page.getByRole("heading", { name: "Next Steps", level: 2 })).toBeVisible();
    await page.screenshot({ path: shot("next-steps-drawer-desktop.png"), fullPage: false });
  });

  test("tasks workspace", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "reference-desktop", "desktop only");
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "Tasks", level: 1 })).toBeVisible();
    await page.screenshot({ path: shot("tasks-workspace-desktop.png"), fullPage: true });
  });

  test("appointments data view", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "reference-desktop", "desktop only");
    await page.goto("/appointments");
    await expect(page.getByRole("heading", { name: "Appointments", level: 1 })).toBeVisible();
    await page.screenshot({ path: shot("appointments-desktop.png"), fullPage: true });
  });
});
