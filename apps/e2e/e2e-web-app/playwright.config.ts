import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
    testDir: "./src",
    fullyParallel: false,
    forbidOnly: true,
    retries: 0,
    timeout: 60_000,
    expect: {
        timeout: 15_000,
    },
    use: {
        headless: true,
        trace: "retain-on-failure",
        video: "retain-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
})

