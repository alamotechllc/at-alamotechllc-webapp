import { expect, test } from "@playwright/test";
import { expectNoUnauthorized, signInWithEmulatorForm, tenantCredentials } from "./helpers.js";

test.describe("tenant Command Center", () => {
  test.beforeEach(async ({ page }) => {
    await signInWithEmulatorForm(page, tenantCredentials.email, tenantCredentials.password);
    await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  });

  test("home loads results and next steps without unauthorized states", async ({ page }) => {
    await expectNoUnauthorized(page);
    await expect(page.getByText(/things need your attention|all caught up/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Results", level: 2 })).toBeVisible();
  });

  test("primary navigation pages load", async ({ page }) => {
    const routes: { path: string; heading: string }[] = [
      { path: "/tasks", heading: "Tasks" },
      { path: "/appointments", heading: "Appointments" },
      { path: "/results", heading: "Results" },
      { path: "/campaigns", heading: "Campaigns" },
    ];
    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByRole("heading", { name: route.heading, level: 1 })).toBeVisible();
      await expectNoUnauthorized(page);
    }
  });

  test("next steps drawer opens and lists pending items", async ({ page }) => {
    await page.getByRole("button", { name: /View all next steps/i }).click();
    await expect(page.getByRole("heading", { name: "Next Steps", level: 2 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Complete" }).first()).toBeVisible();
  });

  test("staff routes stay hidden for tenant admin", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Clients" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Operations" })).toHaveCount(0);
  });
});
