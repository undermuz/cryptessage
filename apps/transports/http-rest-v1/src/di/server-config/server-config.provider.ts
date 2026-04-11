import type { CorsOriginSetting, PowMode, ServerEnv } from "./types.js"

function envBool(name: string, defaultValue: boolean): boolean {
    const v = process.env[name]

    if (v === undefined) {
        return defaultValue
    }

    return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes"
}

/**
 * `CORS_ORIGIN` unset, empty, or `*` → allow any origin (`origin: true`).
 * Single URL → that origin only. Comma-separated → whitelist.
 */
function parseCorsOrigin(): CorsOriginSetting {
    const raw = process.env.CORS_ORIGIN?.trim()

    if (!raw || raw === "*") {
        return true
    }

    if (raw.includes(",")) {
        const parts = raw
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)

        if (parts.length === 0) {
            return true
        }

        if (parts.length === 1) {
            return parts[0]!
        }

        return parts
    }

    return raw
}

function envPowMode(): PowMode {
    const v = process.env.POW_MODE?.trim().toLowerCase()

    if (v === "always") {
        return "always"
    }

    return "adaptive"
}

function envPositiveInt(name: string, defaultValue: number): number {
    const raw = process.env[name]?.trim()
    const n = raw !== undefined ? Number(raw) : defaultValue

    if (!Number.isFinite(n) || n < 1) {
        throw new Error(`${name} must be a positive integer`)
    }

    return Math.floor(n)
}

/**
 * Session tokens must not be keyed from `DEPLOYMENT_SECRET`: clients embed that
 * value in `baseUrl`, so anyone with the link could forge `X-Cryptessage-Session`.
 */
function resolveSessionHmacSecret(powMode: PowMode): string {
    const explicit = process.env.SESSION_HMAC_SECRET?.trim()

    if (powMode === "always") {
        return explicit && explicit.length > 0
            ? explicit
            : "__pow_always_mode_session_signing_unused__"
    }

    if (!explicit || explicit.length === 0) {
        throw new Error(
            "SESSION_HMAC_SECRET is required when POW_MODE=adaptive (default). " +
                "Set a long random server-only value; do not reuse DEPLOYMENT_SECRET — it appears in every client baseUrl.",
        )
    }

    return explicit
}

export function loadServerEnv(): ServerEnv {
    const secret = process.env.DEPLOYMENT_SECRET ?? ""

    if (!secret) {
        throw new Error("DEPLOYMENT_SECRET is required")
    }

    const portRaw = process.env.PORT ?? "3333"
    const port = Number(portRaw)

    if (!Number.isFinite(port) || port <= 0) {
        throw new Error("PORT must be a positive integer")
    }

    const diffRaw = process.env.CHALLENGE_DIFFICULTY_BITS ?? "18"
    const difficultyBits = Number(diffRaw)

    if (
        !Number.isFinite(difficultyBits) ||
        difficultyBits < 1 ||
        difficultyBits > 256
    ) {
        throw new Error("CHALLENGE_DIFFICULTY_BITS must be between 1 and 256")
    }

    const bearer = process.env.INBOX_BEARER_TOKEN?.trim()
    const skipPow = envBool("SKIP_POW", false)

    const pageRaw = process.env.OUTBOX_PAGE_SIZE ?? "50"
    const outboxPageSize = Number(pageRaw)

    if (
        !Number.isFinite(outboxPageSize) ||
        outboxPageSize < 1 ||
        outboxPageSize > 200
    ) {
        throw new Error(
            "OUTBOX_PAGE_SIZE must be an integer between 1 and 200",
        )
    }

    const powIdleMsBeforePow = envPositiveInt(
        "POW_IDLE_MS_BEFORE_POW",
        30 * 60 * 1000,
    )
    const powMaxRps = envPositiveInt("POW_MAX_RPS", 5)
    const powMaxRpm = envPositiveInt("POW_MAX_RPM", 350)
    const sessionMaxTtlMs = envPositiveInt(
        "SESSION_MAX_TTL_MS",
        24 * 60 * 60 * 1000,
    )

    const powMode = envPowMode()

    return {
        port,
        deploymentSecret: secret,
        bearerToken: bearer ? bearer : undefined,
        difficultyBits,
        skipPow,
        outboxPageSize,
        corsOrigin: parseCorsOrigin(),
        powMode,
        powIdleMsBeforePow,
        powMaxRps,
        powMaxRpm,
        sessionHmacSecret: resolveSessionHmacSecret(powMode),
        sessionMaxTtlMs,
    }
}
