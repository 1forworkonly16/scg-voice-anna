import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Worker tests run as a second vitest invocation (the root config only includes tests/unit and tests/lint):
//   vitest run --config tests/worker/vitest.config.ts
export default defineConfig({
  root: fileURLToPath(new URL("../..", import.meta.url) as never),
  test: {
    include: ["tests/worker/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
  },
});
