import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        testTimeout: 120_000,
        hookTimeout: 120_000,
        pool: "threads",
    },
})

