import { ed25519, x25519 } from "@noble/curves/ed25519"

import { bytesToBase64 } from "@/di/secure/encoding"
import type { CompactIdentitySecrets } from "@/di/crypt-db/types-data"

export function generateCompactIdentitySecrets(): CompactIdentitySecrets {
    const xSec = x25519.utils.randomSecretKey()
    const xPub = x25519.getPublicKey(xSec)
    const edSec = ed25519.utils.randomSecretKey()
    const edPub = ed25519.getPublicKey(edSec)

    return {
        x25519PublicKeyB64: bytesToBase64(xPub),
        x25519SecretKeyB64: bytesToBase64(xSec),
        ed25519PublicKeyB64: bytesToBase64(edPub),
        ed25519SecretKeyB64: bytesToBase64(edSec),
    }
}
