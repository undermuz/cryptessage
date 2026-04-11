import { createHash } from "node:crypto"

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
        powMode: "adaptive",
        powIdleMsBeforePow: 30 * 60 * 1000,
        powMaxRps: 5,
        powMaxRpm: 350,
        sessionHmacSecret: "test-session-hmac-secret-test-session-hmac-secret",
        sessionMaxTtlMs: 24 * 60 * 60 * 1000,
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
    extraHeaders?: Record<string, string>,
): Promise<OutboxRes> {
    const q = since ? `?since=${encodeURIComponent(since)}` : ""
    const res = await fetch(
        `${baseUrl}/${deploymentSecret}/v1/outbox/${selfKeyId}${q}`,
        {
            method: "GET",
            headers: { accept: "application/json", ...extraHeaders },
        },
    )

    expect(res.status).toBe(200)
    return (await res.json()) as OutboxRes
}

function countLeadingZeroBits(digest: Uint8Array): number {
    let bits = 0

    for (let i = 0; i < digest.byteLength; i++) {
        const b = digest[i]!

        if (b === 0) {
            bits += 8

            continue
        }

        for (let j = 7; j >= 0; j--) {
            if ((b >> j) & 1) {
                return bits
            }

            bits++
        }

        return bits
    }

    return bits
}

function solvePowCounter(
    nonceB64Url: string,
    deploymentSecret: string,
    difficultyBits: number,
): bigint {
    let b64 = nonceB64Url.replace(/-/g, "+").replace(/_/g, "/")
    const pad = b64.length % 4

    if (pad) {
        b64 += "=".repeat(4 - pad)
    }

    const nonceBytes = Buffer.from(b64, "base64")
    const secretBytes = Buffer.from(deploymentSecret, "utf8")

    for (let c = 0n; c < 0xffffffffffffffffn; c += 1n) {
        const counterBuf = Buffer.allocUnsafe(8)

        counterBuf.writeBigUInt64BE(c, 0)

        const input = Buffer.concat([nonceBytes, secretBytes, counterBuf])
        const digest = createHash("sha256").update(input).digest()

        if (countLeadingZeroBits(digest) >= difficultyBits) {
            return c
        }
    }

    throw new Error("pow not found")
}

function buildPowHeader(nonce: string, counter: bigint): string {
    const proof = {
        algorithm: "sha256-pow-v1",
        nonce,
        counter: counter.toString(),
    }
    const json = JSON.stringify(proof)

    return Buffer.from(json, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
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

describe("http-rest-v1 adaptive PoW session", () => {
    const deploymentSecret = "test-deployment-secret-adapt"
    const cfg: ServerEnv = {
        port: 0,
        deploymentSecret,
        bearerToken: undefined,
        difficultyBits: 4,
        skipPow: false,
        outboxPageSize: 50,
        corsOrigin: true,
        powMode: "adaptive",
        powIdleMsBeforePow: 60_000,
        powMaxRps: 5,
        powMaxRpm: 350,
        sessionHmacSecret: "adapt-test-session-hmac-secret-adapt-test",
        sessionMaxTtlMs: 3600_000,
    }
    let baseUrl = ""
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

    it("second inbox POST uses X-Cryptessage-Session without new PoW", async () => {
        const recipient = "rcpt-pow-session"
        const chRes = await fetch(
            `${baseUrl}/${deploymentSecret}/v1/challenge`,
            { method: "GET" },
        )

        expect(chRes.status).toBe(200)

        const ch = (await chRes.json()) as {
            nonce: string
            difficultyBits: number
            clientHints: { powMode: string }
        }

        expect(ch.clientHints.powMode).toBe("adaptive")

        const counter = solvePowCounter(
            ch.nonce,
            deploymentSecret,
            ch.difficultyBits,
        )
        const pow = buildPowHeader(ch.nonce, counter)
        const body = new TextEncoder().encode("hello-pow-session")

        const post1 = await fetch(
            `${baseUrl}/${deploymentSecret}/v1/inbox/${recipient}`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/octet-stream",
                    "X-Cryptessage-Pow": pow,
                },
                body,
            },
        )

        expect(post1.status).toBe(202)

        const sess = post1.headers.get("X-Cryptessage-Session")

        expect(sess).toBeTruthy()

        const post2 = await fetch(
            `${baseUrl}/${deploymentSecret}/v1/inbox/${recipient}`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/octet-stream",
                    "X-Cryptessage-Session": sess!,
                },
                body,
            },
        )

        expect(post2.status).toBe(202)
        expect(post2.headers.get("X-Cryptessage-Session")).toBeTruthy()
    })
})

describe("http-rest-v1 powMode always", () => {
    const deploymentSecret = "test-deployment-secret-always"
    const cfg: ServerEnv = {
        port: 0,
        deploymentSecret,
        bearerToken: undefined,
        difficultyBits: 4,
        skipPow: false,
        outboxPageSize: 50,
        corsOrigin: true,
        powMode: "always",
        powIdleMsBeforePow: 60_000,
        powMaxRps: 5,
        powMaxRpm: 350,
        sessionHmacSecret: "always-test-session-hmac-secret-always-test",
        sessionMaxTtlMs: 3600_000,
    }
    let baseUrl = ""
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

    it("does not issue session; rejects session-only follow-up", async () => {
        const recipient = "rcpt-always"
        const chRes = await fetch(`${baseUrl}/${deploymentSecret}/v1/challenge`, {
            method: "GET",
        })

        const ch = (await chRes.json()) as {
            nonce: string
            difficultyBits: number
        }
        const counter = solvePowCounter(
            ch.nonce,
            deploymentSecret,
            ch.difficultyBits,
        )
        const pow = buildPowHeader(ch.nonce, counter)

        const post1 = await fetch(
            `${baseUrl}/${deploymentSecret}/v1/inbox/${recipient}`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/octet-stream",
                    "X-Cryptessage-Pow": pow,
                },
                body: new Uint8Array([1]),
            },
        )

        expect(post1.status).toBe(202)
        expect(post1.headers.get("X-Cryptessage-Session")).toBeFalsy()

        const post2 = await fetch(
            `${baseUrl}/${deploymentSecret}/v1/inbox/${recipient}`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/octet-stream",
                    "X-Cryptessage-Session": "dummy",
                },
                body: new Uint8Array([2]),
            },
        )

        expect(post2.status).toBe(401)
    })
})
