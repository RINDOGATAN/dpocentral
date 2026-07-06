import { defineConfig } from "vitest/config";
import path from "path";

// Unit/integration tests run the real routers and middleware chain over a
// module-mocked Prisma (each test file mocks @/lib/prisma). Hermetic and
// fast: no database, no network. Tenant isolation and the role gate are
// asserted on the queries the routers issue.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
