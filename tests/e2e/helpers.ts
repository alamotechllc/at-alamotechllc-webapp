import type { Page } from "@playwright/test";

export const tenantCredentials = {
  email: "tenant.admin@client.example",
  password: "local-dev-only",
};

export const operatorCredentials = {
  email: "operator@alamotechllc.test",
  password: "local-dev-only",
};

export async function signInWithEmulatorForm(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function expectNoUnauthorized(page: Page): Promise<void> {
  const { expect } = await import("@playwright/test");
  await expect(page.getByRole("heading", { name: "Unauthorized" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Access not authorized" })).toHaveCount(0);
}
