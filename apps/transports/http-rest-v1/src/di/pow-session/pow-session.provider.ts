import { createHmac, randomBytes } from "node:crypto"
import { inject, injectable } from "inversify"

import { ServerConfig, type ServerEnv } from "../server-config/types.js"
import type { IPowSessionService } from "./types.js"

type SessionPayloadV1 = {
    v: 1
    sid: string
    iat: number
    rot: number
}

type StoreEntry = {
    issuedAt: number
    lastSeen: number
    /** Request timestamps (ms); pruned to ~60s retention. */
    times: number[]
    rot: number
}

function toBase64Url(buf: Buffer): string {
    return buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
        return false
    }

    let x = 0

    for (let i = 0; i < a.length; i++) {
        x |= a[i]! ^ b[i]!
    }

    return x === 0
}

@injectable()
export class PowSessionProvider implements IPowSessionService {
    private readonly store = new Map<string, StoreEntry>()

    constructor(@inject(ServerConfig) private readonly config: ServerEnv) {}

    private signPayloadB64(payloadB64: string): string {
        const mac = createHmac("sha256", this.config.sessionHmacSecret)
            .update(payloadB64)
            .digest()

        return `${payloadB64}.${toBase64Url(mac)}`
    }

    private parseAndVerify(token: string): SessionPayloadV1 | null {
        const parts = token.trim().split(".")

        if (parts.length !== 2) {
            return null
        }

        const [payloadB64, sigB64] = parts

        if (!payloadB64 || !sigB64) {
            return null
        }

        let sig: Buffer

        try {
            let b64 = sigB64.replace(/-/g, "+").replace(/_/g, "/")
            const pad = b64.length % 4

            if (pad) {
                b64 += "=".repeat(4 - pad)
            }

            sig = Buffer.from(b64, "base64")
        } catch {
            return null
        }

        const expected = createHmac("sha256", this.config.sessionHmacSecret)
            .update(payloadB64)
            .digest()

        if (!timingSafeEqual(sig, expected)) {
            return null
        }

        let payloadJson: string

        try {
            let b64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/")
            const pad = b64.length % 4

            if (pad) {
                b64 += "=".repeat(4 - pad)
            }

            payloadJson = Buffer.from(b64, "base64").toString("utf8")
        } catch {
            return null
        }

        let o: unknown

        try {
            o = JSON.parse(payloadJson) as unknown
        } catch {
            return null
        }

        if (
            typeof o !== "object" ||
            o === null ||
            (o as SessionPayloadV1).v !== 1 ||
            typeof (o as SessionPayloadV1).sid !== "string" ||
            typeof (o as SessionPayloadV1).iat !== "number" ||
            typeof (o as SessionPayloadV1).rot !== "number"
        ) {
            return null
        }

        return o as SessionPayloadV1
    }

    public issueAfterPow(): string {
        const sid = toBase64Url(randomBytes(16))
        const issuedAt = Date.now()

        this.store.set(sid, {
            issuedAt,
            lastSeen: issuedAt,
            times: [issuedAt],
            rot: 0,
        })

        const body: SessionPayloadV1 = {
            v: 1,
            sid,
            iat: issuedAt,
            rot: 0,
        }
        const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(body), "utf8"))

        return this.signPayloadB64(payloadB64)
    }

    public rotateAfterSessionAuth(token: string): string | null {
        const payload = this.parseAndVerify(token)

        if (!payload) {
            return null
        }

        const now = Date.now()
        const entry = this.store.get(payload.sid)

        if (!entry) {
            return null
        }

        if (payload.iat !== entry.issuedAt || payload.rot !== entry.rot) {
            return null
        }

        if (now - entry.issuedAt > this.config.sessionMaxTtlMs) {
            this.store.delete(payload.sid)

            return null
        }

        if (now - entry.lastSeen > this.config.powIdleMsBeforePow) {
            this.store.delete(payload.sid)

            return null
        }

        const pruneBefore = now - 65_000

        entry.times = entry.times.filter((t) => t >= pruneBefore)

        const in1s = entry.times.filter((t) => t > now - 1000).length

        if (in1s >= this.config.powMaxRps) {
            this.store.delete(payload.sid)

            return null
        }

        const in60 = entry.times.filter((t) => t > now - 60_000).length

        if (in60 >= this.config.powMaxRpm) {
            this.store.delete(payload.sid)

            return null
        }

        entry.times.push(now)
        entry.lastSeen = now
        entry.rot += 1

        const body: SessionPayloadV1 = {
            v: 1,
            sid: payload.sid,
            iat: entry.issuedAt,
            rot: entry.rot,
        }
        const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(body), "utf8"))

        return this.signPayloadB64(payloadB64)
    }
}
