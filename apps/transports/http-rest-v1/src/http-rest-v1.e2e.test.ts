import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { ServerEnv } from "./di/server-config/types.js"
import { buildHttpRestV1Server } from "./server.js"

type OutboxRes = { nextCursor: string | null; messages: string[] }

function testConfig(): ServerEnv {
    return {
        port: 0,
        deploymentSecret: "test-deployment-secret",
        bearerToken: undefined,
        difficultyBits: 1,
        skipPow: true,
        outboxPageSize: 50,
        corsOrigin: true,
    }
}

async function postInbox(
    baseUrl: string,
    deploymentSecret: string,
    recipientKeyId: string,
    bytes: Uint8Array,
): Promise<Response> {
    return fetch(`${baseUrl}/${deploymentSecret}/v1/inbox/${recipientKeyId}`, {
        method: "POST",
        headers: {
            "content-type": "application/octet-stream",
        },
        body: bytes,
    })
}

async function getOutbox(
    baseUrl: string,
    deploymentSecret: string,
    selfKeyId: string,
    since?: string,
): Promise<OutboxRes> {
    const q = since ? `?since=${encodeURIComponent(since)}` : ""
    const res = await fetch(
        `${baseUrl}/${deploymentSecret}/v1/outbox/${selfKeyId}${q}`,
        {
            method: "GET",
            headers: { accept: "application/json" },
        },
    )

    expect(res.status).toBe(200)
    return (await res.json()) as OutboxRes
}

describe("http-rest-v1 server e2e", () => {
    const cfg = testConfig()
    let baseUrl = ""
    const deploymentSecret = cfg.deploymentSecret
    const appPromise = buildHttpRestV1Server(cfg, { logger: false })
    let app: Awaited<typeof appPromise>

    beforeAll(async () => {
        app = await appPromise
        await app.listen({ port: 0, host: "127.0.0.1" })

        const addr = app.server.address()

        if (!addr || typeof addr === "string") {
            throw new Error("unexpected listen address")
        }

        baseUrl = `http://127.0.0.1:${addr.port}`
    })

    afterAll(async () => {
        await app.close()
    })

    it("one-peer (self chat): inbox -> outbox returns once then cursor prevents duplicates", async () => {
        const selfKeyId = "fav-self"
        const payload = new TextEncoder().encode("hello-self-1")

        const post = await postInbox(
            baseUrl,
            deploymentSecret,
            selfKeyId,
            payload,
        )

        expect(post.status).toBe(202)

        const first = await getOutbox(baseUrl, deploymentSecret, selfKeyId)

        expect(first.messages.length).toBe(1)
        expect(
            typeof first.nextCursor === "string" || first.nextCursor === null,
        ).toBe(true)
        expect(first.nextCursor).not.toBeNull()

        const second = await getOutbox(
            baseUrl,
            deploymentSecret,
            selfKeyId,
            first.nextCursor ?? undefined,
        )

        expect(second.messages).toEqual([])
    })

    it("two-peer: each inbox delivers only to its matching outbox and cursors are independent", async () => {
        const alice = "alice"
        const bob = "bob"

        const msgToBob = new TextEncoder().encode("to-bob-1")
        const msgToAlice = new TextEncoder().encode("to-alice-1")

        expect(
            (await postInbox(baseUrl, deploymentSecret, bob, msgToBob)).status,
        ).toBe(202)
        expect(
            (await postInbox(baseUrl, deploymentSecret, alice, msgToAlice))
                .status,
        ).toBe(202)

        const bobOut1 = await getOutbox(baseUrl, deploymentSecret, bob)

        expect(bobOut1.messages.length).toBe(1)
        expect(bobOut1.nextCursor).not.toBeNull()

        const aliceOut1 = await getOutbox(baseUrl, deploymentSecret, alice)

        expect(aliceOut1.messages.length).toBe(1)
        expect(aliceOut1.nextCursor).not.toBeNull()

        const bobOut2 = await getOutbox(
            baseUrl,
            deploymentSecret,
            bob,
            bobOut1.nextCursor ?? undefined,
        )

        expect(bobOut2.messages).toEqual([])

        const aliceOut2 = await getOutbox(
            baseUrl,
            deploymentSecret,
            alice,
            aliceOut1.nextCursor ?? undefined,
        )

        expect(aliceOut2.messages).toEqual([])
    })
})
