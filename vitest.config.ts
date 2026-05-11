// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup/setup.ts",'./tests/setup/prismaMock.ts'],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules", "dist", "prisma"],
    },
    // unit আর integration আলাদা
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});