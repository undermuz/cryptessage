import { PBKDF2_ITERATIONS } from "./constants"

/**
 * Derives a 256-bit AES-GCM key from a passphrase and salt (never persisted).
 */
export async function deriveAesGcmKey(
    passphrase: string,
    salt: Uint8Array,
): Promise<CryptoKey> {
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(passphrase),
        "PBKDF2",
        false,
        ["deriveKey"],
    )

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt as BufferSource,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    )
}
