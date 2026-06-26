import { defineConfig } from "vitest/config";

/**
 * Vitest config for the backend payment-logic suite.
 *
 * The source uses NodeNext module resolution, so intra-package imports carry a
 * ".js" specifier (e.g. `import { config } from "./config.js"`) that must resolve
 * to the ".ts" source under test. Vite/vitest resolve ".js"-specified imports to
 * the sibling ".ts" file out of the box, so no extra alias is needed.
 *
 * Tests run with NODE_ENV=test so importing the HTTP app does not bind a port
 * (see backend/src/index.ts startServer guard).
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["test/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
    },
  },
});
