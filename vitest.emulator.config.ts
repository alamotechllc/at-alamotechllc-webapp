import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@raas/domain": path.resolve("packages/domain/src/index.ts"),
      "@raas/logging": path.resolve("packages/logging/src/index.ts"),
      "@raas/auth": path.resolve("packages/auth/src/index.ts"),
      "@raas/store": path.resolve("packages/store/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/emulator/**/*.test.ts", "tests/security/rules.test.ts"],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
