import {
    COMPACT_KEY_LEN,
    COMPACT_VISIT_CARD_VERSION,
    COMPACT_VISIT_MIN_LEN,
} from "./compact-constants"

export type CompactVisitCardDecoded = {
    displayName: string
    x25519PublicKey: Uint8Array
    ed25519PublicKey: Uint8Array
}

export function isCompactVisitCardV1(bytes: Uint8Array): boolean {
    if (bytes.byteLength < COMPACT_VISIT_MIN_LEN) {
        return false
    }

    if (bytes[0] !== COMPACT_VISIT_CARD_VERSION) {
        return false
    }

    const nameLen = bytes[65] ?? 0

    return 66 + nameLen === bytes.byteLength && nameLen <= 255
}

export function encodeVisitCardV1(
    displayName: string,
    x25519PublicKey: Uint8Array,
    ed25519PublicKey: Uint8Array,
): Uint8Array {
    if (x25519PublicKey.byteLength !== COMPACT_KEY_LEN) {
        throw new Error("X25519 public key must be 32 bytes")
    }

    if (ed25519PublicKey.byteLength !== COMPACT_KEY_LEN) {
        throw new Error("Ed25519 public key must be 32 bytes")
    }

    const nameUtf8 = new TextEncoder().encode(displayName)

    if (nameUtf8.length > 255) {
        throw new Error("Display name is too long for compact visit card")
    }

    const out = new Uint8Array(66 + nameUtf8.length)
    let o = 0
    out[o++] = COMPACT_VISIT_CARD_VERSION
    out.set(x25519PublicKey, o)
    o += COMPACT_KEY_LEN
    out.set(ed25519PublicKey, o)
    o += COMPACT_KEY_LEN
    out[o++] = nameUtf8.length
    out.set(nameUtf8, o)
    return out
}

export function decodeVisitCardV1(bytes: Uint8Array): CompactVisitCardDecoded {
    if (!isCompactVisitCardV1(bytes)) {
        throw new Error("Invalid compact visit card v1")
    }

    const x25519PublicKey = bytes.subarray(1, 33)
    const ed25519PublicKey = bytes.subarray(33, 65)
    const nameLen = bytes[65]

    if (nameLen === undefined) {
        throw new Error("Invalid compact visit card v1")
    }

    const nameBytes = bytes.subarray(66, 66 + nameLen)
    const displayName = new TextDecoder().decode(nameBytes)

    return { displayName, x25519PublicKey, ed25519PublicKey }
}
