import type { CorsOriginSetting, ServerEnv } from "./types.js"

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

    return {
        port,
        deploymentSecret: secret,
        bearerToken: bearer ? bearer : undefined,
        difficultyBits,
        skipPow,
        outboxPageSize,
        corsOrigin: parseCorsOrigin(),
    }
}
