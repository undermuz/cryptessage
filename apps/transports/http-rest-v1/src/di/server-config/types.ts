export const ServerConfig = Symbol.for("@cryptessage/http-rest-v1:ServerConfig")

/** `true` = allow any browser origin (reflect `Origin`, same as `@fastify/cors` `origin: true`). */
export type CorsOriginSetting = boolean | string | string[]

export type PowMode = "adaptive" | "always"

/** Mirrors optional `clientHints` in GET `/challenge` (clients may override via profile JSON). */
export type PowClientHints = {
    powMode: PowMode
    idleMsBeforePow: number
    maxRps: number
    maxRpm: number
}

export type ServerEnv = {
    /**
     * Opaque id for this process lifetime; when it changes (server restart), clients drop
     * the HTTP REST outbox cursor so polling works against a fresh in-memory seq space.
     */
    storeEpoch: string
    port: number
    deploymentSecret: string
    bearerToken: string | undefined
    difficultyBits: number
    skipPow: boolean
    outboxPageSize: number
    corsOrigin: CorsOriginSetting
    /** Default `adaptive`: PoW once, then short-lived signed session until idle or rate exceeded. */
    powMode: PowMode
    /** Sliding idle: if no request on this session for this long, next request must use PoW again. */
    powIdleMsBeforePow: number
    /** Max requests per rolling 1s window per session (server-enforced). */
    powMaxRps: number
    /** Max requests per rolling 60s window per session (server-enforced). */
    powMaxRpm: number
    /** HMAC key for `X-Cryptessage-Session` tokens (prefer explicit env). */
    sessionHmacSecret: string
    /** Hard cap on session age from first issue (`iat` in token), even if active. */
    sessionMaxTtlMs: number
}
