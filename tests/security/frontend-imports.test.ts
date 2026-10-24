import { describe, expect, it } from "vitest";
import { findForbiddenImports, scanFrontend } from "../../scripts/guard-frontend-imports.js";

describe("frontend import guard", () => {
  it("flags backend packages", () => {
    expect(findForbiddenImports('import admin from "firebase-admin";')).toContain("firebase-admin");
    expect(findForbiddenImports('import { firestore } from "@raas/store";')).toContain("@raas/store");
  });

  it("finds no forbidden imports under apps/web", () => {
    expect(scanFrontend()).toEqual([]);
  });
});
