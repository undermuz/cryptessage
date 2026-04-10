import net from "node:net"
import { fileURLToPath } from "node:url"

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { chromium, type Browser, type Page } from "playwright"

import type { ViteDevServer } from "vite"
import { createServer, loadConfigFromFile, mergeConfig } from "vite"

import type { ServerEnv } from "../../../transports/http-rest-v1/src/di/server-config/types.js"
import { buildHttpRestV1Server } from "../../../transports/http-rest-v1/src/server.js"

function pickFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const s = net.createServer()

        s.unref()
        s.on("error", reject)
        s.listen(0, "127.0.0.1", () => {
            const addr = s.address()

            if (!addr || typeof addr === "string") {
                reject(new Error("failed to pick free port"))
                return
            }

            const port = addr.port

            s.close(() => resolve(port))
        })
    })
}

function httpServerConfig(): ServerEnv {
    return {
        port: 0,
        deploymentSecret: `e2e-${Math.random().toString(16).slice(2)}`,
        bearerToken: undefined,
        difficultyBits: 1,
        skipPow: true,
        outboxPageSize: 50,
        corsOrigin: true,
    }
}

async function startWebApp(): Promise<{ server: ViteDevServer; baseUrl: string }> {
    const cfgPath = new URL("../../../web-app/vite.config.mts", import.meta.url)
    const loaded = await loadConfigFromFile(
        { command: "serve", mode: "development" },
        fileURLToPath(cfgPath),
    )

    if (!loaded?.config) {
        throw new Error("could not load web-app vite config")
    }

    const port = await pickFreePort()

    const merged = mergeConfig(loaded.config, {
        server: {
            host: "127.0.0.1",
            port,
            strictPort: true,
            // HMR/React Refresh sometimes double-injects in test harnesses.
            // We only need a stable app shell for e2e flows.
            hmr: false,
        },
    })

    const server = await createServer(merged)

    await server.listen()

    const url = server.resolvedUrls?.local?.[0]

    if (!url) {
        throw new Error("vite did not provide local url")
    }

    return { server, baseUrl: url.replace(/\/$/, "") }
}

async function createVault(page: Page): Promise<void> {
    await page.goto("/unlock", { waitUntil: "domcontentloaded" })

    // Ensure Create tab is active (fresh DB should auto-select it, but wait is flaky).
    const createTab = page.getByRole("tab", { name: "Create vault" })

    if (await createTab.isVisible().catch(() => false)) {
        await createTab.click()
    }

    await page.getByPlaceholder("Display name (on your key)").waitFor()

    await page.getByPlaceholder("Display name (on your key)").fill("E2E User")
    await page.getByPlaceholder("Passphrase").first().fill("passpasspass")
    await page.getByPlaceholder("Repeat passphrase").fill("passpasspass")
    await page.getByRole("button", { name: "Create and continue" }).click()

    await page.waitForSelector("text=Settings", { timeout: 15_000 })
}

async function addHttpRestProfile(
    page: Page,
    opts: { baseUrl: string; outboxSelfKeyId: string },
): Promise<void> {
    await page.click("text=Settings")
    await page.waitForSelector("text=Message transports", { timeout: 15_000 })

    await page.selectOption('select >> xpath=.. >> text="http_rest_v1"', {
        label: "http_rest_v1",
    }).catch(async () => {
        // Fallback: select by label if DOM changes.
        await page.getByLabel("Type").selectOption("http_rest_v1")
    })

    const config = {
        baseUrl: opts.baseUrl,
        outboxSelfKeyId: opts.outboxSelfKeyId,
        skipPow: true,
        pollIntervalMs: 1000,
        timeoutMs: 15_000,
    }

    await page.getByLabel("Config (JSON object)").fill(JSON.stringify(config, null, 2))
    await page.getByRole("button", { name: "Add to list" }).click()
    await page.getByRole("button", { name: "Save transport settings" }).click()
    await page.waitForSelector("text=Transport settings saved.", { timeout: 15_000 })
}

async function addSelfContactFromVisitCard(page: Page): Promise<void> {
    await page.click("text=Contacts")
    await page.waitForSelector("h1:text-is(\"Contacts\")", { timeout: 15_000 })

    await page.getByRole("button", { name: "Show QR" }).click()
    await page.getByRole("button", { name: "Copy visit card (JSON)" }).click()

    const visitJson = await page
        .getByRole("textbox", { name: "Copy visit card (JSON)" })
        .inputValue()

    expect(visitJson.trim().startsWith("{")).toBe(true)

    await page.getByRole("button", {
        name: "Paste visit card (JSON), armored public key block, or scan QR — not the fingerprint hex",
    }).click()

    await page
        .getByPlaceholder(
            "JSON visit card, or full -----BEGIN PGP PUBLIC KEY BLOCK----- (not fingerprint hex)",
        )
        .fill(visitJson)

    await page.getByRole("button", { name: "Add contact" }).click()

    await page.waitForSelector("text=E2E User", { timeout: 15_000 })
}

async function openChat(page: Page): Promise<void> {
    await page.click("text=Chats")
    await page.waitForSelector("h1:text-is(\"Chats\")", { timeout: 15_000 })

    await page.getByRole("link", { name: /E2E User/ }).first().click()
    await page
        .getByPlaceholder("Recipient key id for http_rest_v1")
        .waitFor({ timeout: 15_000 })
}

async function waitForLocatorCount(
    locator: ReturnType<Page["locator"]>,
    expected: number,
    timeoutMs = 15_000,
): Promise<void> {
    const started = Date.now()

    // Simple polling helper (Vitest expect doesn't include Playwright matchers).
    // We keep it tiny to avoid introducing extra deps.
    while (true) {
        const n = await locator.count()

        if (n === expected) {
            return
        }

        if (Date.now() - started > timeoutMs) {
            throw new Error(`Timed out waiting for locator count=${expected} (got ${n})`)
        }

        await new Promise((r) => setTimeout(r, 200))
    }
}

describe("e2e-web-app: http_rest_v1 self-chat duplicates", () => {
    const serverCfg = httpServerConfig()
    const selfKeyId = "fav-self"

    let transportApp: Awaited<ReturnType<typeof buildHttpRestV1Server>>
    let transportBaseUrl = ""

    let web: { server: ViteDevServer; baseUrl: string }
    let browser: Browser
    let page: Page

    beforeAll(async () => {
        transportApp = await buildHttpRestV1Server(serverCfg, { logger: false })
        await transportApp.listen({ port: 0, host: "127.0.0.1" })

        const addr = transportApp.server.address()

        if (!addr || typeof addr === "string") throw new Error("bad server address")

        transportBaseUrl = `http://127.0.0.1:${addr.port}/${serverCfg.deploymentSecret}/v1`

        web = await startWebApp()

        browser = await chromium.launch()
        page = await browser.newPage({ baseURL: web.baseUrl })
    })

    afterAll(async () => {
        await page?.close()
        await browser?.close()
        await web?.server.close()
        await transportApp?.close()
    })

    it("sends via http_rest_v1 without opening modal and marks as sent", async () => {
        await createVault(page)

        await addHttpRestProfile(page, {
            baseUrl: transportBaseUrl,
            outboxSelfKeyId: selfKeyId,
        })

        await addSelfContactFromVisitCard(page)
        await openChat(page)

        await page.getByPlaceholder("Recipient key id for http_rest_v1").fill(selfKeyId)
        await page.getByRole("button", { name: "Save" }).click()

        const msg = `hello-e2e-${Date.now()}`

        await page.getByLabel("Type a message…").fill(msg)
        await page.keyboard.press("Enter")

        // Happy path should not open the encrypted send modal.
        await waitForLocatorCount(page.locator("text=Encrypted message (QR & text)"), 0, 2000)

        // Should not show "no transport" toast.
        await waitForLocatorCount(
            page.locator("text=No transport could handle outgoing message"),
            0,
            2000,
        )

        // Wait until the outbound bubble is marked as sent (check icon).
        const outboundBubble = page
            .locator(`xpath=//li[contains(@class,'justify-end')][contains(., ${JSON.stringify(msg)})]`)
            .first()

        await outboundBubble.waitFor({ timeout: 15_000 })
        await waitForLocatorCount(
            outboundBubble.locator('[aria-label="Sent"]'),
            1,
            15_000,
        )
    })

    it("does not duplicate message in self-chat after repeated receives", async () => {
        // Reuse existing vault, transport, and contact; just send a new message.
        const msg = `dup-e2e-${Date.now()}`

        await page.getByLabel("Type a message…").fill(msg)
        await page.keyboard.press("Enter")

        // Give background polling a few cycles to deliver inbound.
        await page.waitForTimeout(8000)

        // Give background polling a few cycles to deliver inbound.
        const inboundHits = await page
            .locator(
                `xpath=//li[contains(@class,'justify-start')][contains(., ${JSON.stringify(
                    msg,
                )})]`,
            )
            .count()
        const outboundHits = await page
            .locator(
                `xpath=//li[contains(@class,'justify-end')][contains(., ${JSON.stringify(
                    msg,
                )})]`,
            )
            .count()

        // In self-chat it's expected to see 2 items total: one outbound (saved on send)
        // and one inbound (fetched from outbox). The bug is when inbound repeats.
        expect(outboundHits).toBe(1)
        expect(inboundHits).toBe(1)
    })
})

