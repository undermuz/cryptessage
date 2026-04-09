import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"

export function payloadByteLength(raw: VisitCardRawPayload): number {
    return typeof raw === "string"
        ? new TextEncoder().encode(raw).length
        : raw.byteLength
}

export function initialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)

    if (parts.length === 0) {
        return "?"
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase()
    }

    return (
        (parts[0][0] ?? "").toUpperCase() + (parts[1][0] ?? "").toUpperCase()
    )
}

