import { injectable } from "inversify"

import { extractDeploymentSecretFromBaseUrl } from "./deployment-secret"
import { buildPowProofFromChallenge, solveSha256PowV1 } from "./pow-sha256-pow"
import type {
    HttpRestParsedConfig,
    HttpRestPowMode,
    PowChallenge,
    PowClientHints,
} from "./types"

const DEFAULT_HINTS: PowClientHints = {
    powMode: "adaptive",
    idleMsBeforePow: 30 * 60 * 1000,
    maxRps: 5,
    maxRpm: 350,
}

type ServerHints = Partial<PowClientHints>

type Bucket = {
    sessionToken: string | null
    /** Last successful inbox/outbox (or challenge refresh) time. */
    lastSuccessAt: number
    requestTimestamps: number[]
    serverHints: ServerHints | null
}

function bucketKey(baseUrl: string): string {
    return baseUrl.trim().replace(/\/$/, "")
}

function mergeEffectivePolicy(
    cfg: HttpRestParsedConfig,
    bucket: Bucket,
): PowClientHints {
    const s = bucket.serverHints ?? {}

    const powMode: HttpRestPowMode =
        cfg.powMode ?? s.powMode ?? DEFAULT_HINTS.powMode

    const idleMsBeforePow = Math.floor(
        cfg.powIdleMsBeforePow ??
            s.idleMsBeforePow ??
            DEFAULT_HINTS.idleMsBeforePow,
    )

    const maxRps = Math.floor(
        cfg.powMaxRps ?? s.maxRps ?? DEFAULT_HINTS.maxRps,
    )

    const maxRpm = Math.floor(
        cfg.powMaxRpm ?? s.maxRpm ?? DEFAULT_HINTS.maxRpm,
    )

    return {
        powMode,
        idleMsBeforePow: Math.max(1000, idleMsBeforePow),
        maxRps: Math.max(1, maxRps),
        maxRpm: Math.max(1, maxRpm),
    }
}

function applyChallengeHints(bucket: Bucket, challenge: PowChallenge): void {
    const raw = challenge.clientHints

    if (raw === undefined || raw === null || typeof raw !== "object") {
        return
    }

    const o = raw as Record<string, unknown>
    const next: ServerHints = { ...(bucket.serverHints ?? {}) }

    if (o.powMode === "adaptive" || o.powMode === "always") {
        next.powMode = o.powMode
    }

    if (
        typeof o.idleMsBeforePow === "number" &&
        Number.isFinite(o.idleMsBeforePow) &&
        o.idleMsBeforePow >= 1000
    ) {
        next.idleMsBeforePow = Math.floor(o.idleMsBeforePow)
    }

    if (
        typeof o.maxRps === "number" &&
        Number.isFinite(o.maxRps) &&
        o.maxRps >= 1
    ) {
        next.maxRps = Math.floor(o.maxRps)
    }

    if (
        typeof o.maxRpm === "number" &&
        Number.isFinite(o.maxRpm) &&
        o.maxRpm >= 1
    ) {
        next.maxRpm = Math.floor(o.maxRpm)
    }

    bucket.serverHints = next
}

@injectable()
export class HttpRestPowCoordinatorProvider {
    private readonly buckets = new Map<string, Bucket>()

    private getBucket(key: string): Bucket {
        let b = this.buckets.get(key)

        if (!b) {
            b = {
                sessionToken: null,
                lastSuccessAt: 0,
                requestTimestamps: [],
                serverHints: null,
            }
            this.buckets.set(key, b)
        }

        return b
    }

    /**
     * Builds `X-Cryptessage-Pow` or `X-Cryptessage-Session` headers for one outbound request.
     */
    public async buildAuthHeaders(
        cfg: HttpRestParsedConfig,
        signal: AbortSignal,
    ): Promise<Record<string, string>> {
        if (cfg.skipPow) {
            return {}
        }

        const key = bucketKey(cfg.baseUrl)
        const bucket = this.getBucket(key)
        const pol = mergeEffectivePolicy(cfg, bucket)
        const now = Date.now()

        const pruneBefore = now - 65_000

        bucket.requestTimestamps = bucket.requestTimestamps.filter(
            (t) => t >= pruneBefore,
        )

        let forcePow = pol.powMode === "always" || !bucket.sessionToken

        if (
            !forcePow &&
            bucket.lastSuccessAt > 0 &&
            now - bucket.lastSuccessAt > pol.idleMsBeforePow
        ) {
            forcePow = true
            bucket.sessionToken = null
        }

        if (!forcePow) {
            const in1s = bucket.requestTimestamps.filter(
                (t) => t > now - 1000,
            ).length
            const in60 = bucket.requestTimestamps.filter(
                (t) => t > now - 60_000,
            ).length

            if (in1s >= pol.maxRps || in60 >= pol.maxRpm) {
                forcePow = true
                bucket.sessionToken = null
            }
        }

        if (!forcePow && bucket.sessionToken) {
            bucket.requestTimestamps.push(now)

            return { "X-Cryptessage-Session": bucket.sessionToken }
        }

        bucket.sessionToken = null

        const chRes = await fetch(`${cfg.baseUrl}/challenge`, {
            method: "GET",
            signal,
            headers: { Accept: "application/json" },
        })

        if (!chRes.ok) {
            throw new Error(`http_rest_v1: challenge HTTP ${chRes.status}`)
        }

        const challenge = (await chRes.json()) as PowChallenge

        applyChallengeHints(bucket, challenge)

        const expires = Date.parse(challenge.expiresAt)

        if (Number.isFinite(expires) && Date.now() > expires) {
            throw new Error("http_rest_v1: challenge expired")
        }

        const depSecret = extractDeploymentSecretFromBaseUrl(cfg.baseUrl)
        const { counter } = await solveSha256PowV1(challenge, depSecret)

        bucket.requestTimestamps.push(Date.now())

        return {
            "X-Cryptessage-Pow": buildPowProofFromChallenge(
                challenge,
                counter,
            ),
        }
    }

    public onSuccessfulResponse(
        cfg: HttpRestParsedConfig,
        response: Response,
    ): void {
        if (cfg.skipPow) {
            return
        }

        const key = bucketKey(cfg.baseUrl)
        const bucket = this.getBucket(key)
        const now = Date.now()

        if (!response.ok) {
            return
        }

        const next = response.headers.get("X-Cryptessage-Session")

        if (next?.trim()) {
            bucket.sessionToken = next.trim()
        }

        bucket.lastSuccessAt = now
    }

    public onAuthFailure(cfg: HttpRestParsedConfig): void {
        if (cfg.skipPow) {
            return
        }

        const bucket = this.getBucket(bucketKey(cfg.baseUrl))

        bucket.sessionToken = null
    }
}
