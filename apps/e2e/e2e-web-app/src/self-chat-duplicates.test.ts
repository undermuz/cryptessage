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

/** Matches `chat.messagePlaceholder` in web-app i18n. */
const MESSAGE_COMPOSER_PLACEHOLDER = "Type a message…"

const PASTE_VISIT_TRIGGER =
    "Paste visit card (JSON), armored public key block, or scan QR — not the fingerprint hex"

const VISIT_CARD_PASTE_PLACEHOLDER =
    "JSON visit card, or full -----BEGIN PGP PUBLIC KEY BLOCK----- (not fingerprint hex)"

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

    const createTab = page.getByRole("tab", { name: "Create vault" })

    if (await createTab.isVisible().catch(() => false)) {
        await createTab.click()
    }

    await page.getByPlaceholder("Display name (on your key)").waitFor()

    await page.getByPlaceholder("Display name (on your key)").fill("E2E User")
    await page.getByPlaceholder("Passphrase").first().fill("passpasspass")
    await page.getByPlaceholder("Repeat passphrase").fill("passpasspass")
    await page.getByRole("button", { name: "Create and continue" }).click()

    await page.getByRole("link", { name: "Settings" }).waitFor({ timeout: 15_000 })
}

async function addHttpRestProfile(
    page: Page,
    opts: { baseUrl: string; outboxSelfKeyId: string },
): Promise<void> {
    await page.getByRole("link", { name: "Settings" }).click()
    await page.getByText("Message transports", { exact: false }).waitFor({
        timeout: 15_000,
    })

    const addForm = page.getByText("New profile", { exact: true }).locator("..")

    await addForm.locator("select").waitFor({ state: "visible", timeout: 10_000 })
    await addForm.locator("select").selectOption("http_rest_v1")

    const config = {
        baseUrl: opts.baseUrl,
        outboxSelfKeyId: opts.outboxSelfKeyId,
        skipPow: true,
        pollIntervalMs: 1000,
        timeoutMs: 15_000,
    }

    await addForm
        .getByRole("textbox", { name: "Config (JSON object)" })
        .fill(JSON.stringify(config, null, 2))
    await page.getByRole("button", { name: "Add to list" }).click()
    await page.getByRole("button", { name: "Save transport settings" }).click()
    await page.getByText("Transport settings saved.", { exact: false }).waitFor({
        timeout: 15_000,
    })
}

/**
 * Default visit card format is Compact v1 (base64), not OpenPGP JSON — read payload from the
 * armored preview textarea after expanding its disclosure, then paste under “Add contact”.
 */
async function addSelfContactFromVisitCard(page: Page): Promise<void> {
    await page.getByRole("link", { name: "Contacts" }).click()
    await page.getByRole("heading", { name: "Contacts", exact: true }).waitFor({
        timeout: 15_000,
    })

    await page.getByRole("button", { name: "Show QR" }).click()

    const copyCardTrigger = page.getByRole("button", { name: "Copy visit card (JSON)" }).first()

    await copyCardTrigger.waitFor({ state: "visible", timeout: 30_000 })
    await copyCardTrigger.click()

    const visitCardTextbox = page.getByRole("textbox", {
        name: "Copy visit card (JSON)",
    })

    await visitCardTextbox.waitFor({ state: "visible", timeout: 15_000 })

    const visitPayload = await visitCardTextbox.inputValue()

    expect(visitPayload.trim().length).toBeGreaterThan(20)

    await page.getByRole("button", { name: PASTE_VISIT_TRIGGER }).click()

    await page.getByPlaceholder(VISIT_CARD_PASTE_PLACEHOLDER).fill(visitPayload)
    await page.getByRole("button", { name: "Add contact" }).click()

    await page.getByText("E2E User", { exact: false }).first().waitFor({
        timeout: 15_000,
    })
}

async function openChat(page: Page): Promise<void> {
    await page.getByRole("link", { name: "Chats" }).click()
    await page.getByRole("heading", { name: "Chats", exact: true }).waitFor({
        timeout: 15_000,
    })

    await page.getByRole("link", { name: /E2E User/i }).first().click()
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

        await page
            .getByPlaceholder(MESSAGE_COMPOSER_PLACEHOLDER)
            .waitFor({ state: "visible", timeout: 15_000 })
        await page.getByPlaceholder(MESSAGE_COMPOSER_PLACEHOLDER).fill(msg)
        await page.keyboard.press("Enter")

        await waitForLocatorCount(page.locator("text=Encrypted message (QR & text)"), 0, 2000)

        await waitForLocatorCount(
            page.locator("text=No transport could handle outgoing message"),
            0,
            2000,
        )

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
        const msg = `dup-e2e-${Date.now()}`

        await page
            .getByPlaceholder(MESSAGE_COMPOSER_PLACEHOLDER)
            .waitFor({ state: "visible", timeout: 15_000 })
        await page.getByPlaceholder(MESSAGE_COMPOSER_PLACEHOLDER).fill(msg)
        await page.keyboard.press("Enter")

        await page.waitForTimeout(8000)

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

        expect(outboundHits).toBe(1)
        expect(inboundHits).toBe(1)
    })
})
