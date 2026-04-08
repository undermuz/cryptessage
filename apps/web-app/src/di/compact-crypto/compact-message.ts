import { secretbox } from "@noble/ciphers/salsa"
import { ed25519, x25519 } from "@noble/curves/ed25519"
import { sha256 } from "@noble/hashes/sha256"

import {
    COMPACT_ED25519_SIG_LEN,
    COMPACT_KEY_LEN,
    COMPACT_MESSAGE_VERSION,
} from "./compact-constants"

const NONCE_LEN = 24
const MAC_LEN = 16

/** Fixed domain separation for deriving XSalsa20-Poly1305 key from X25519 shared secret. */
const KDF_INFO = new TextEncoder().encode("cryptessage/compact_v1/xsalsa20")

function deriveAeadKey(sharedSecret: Uint8Array): Uint8Array {
    const payload = new Uint8Array(
        sharedSecret.byteLength + KDF_INFO.byteLength,
    )

    payload.set(sharedSecret, 0)
    payload.set(KDF_INFO, sharedSecret.byteLength)
    return sha256(payload)
}

/**
 * Wire layout (spec):
 * 0: version 0x02
 * 1..32: ephemeral X25519 public key
 * 33..56: XSalsa20 nonce (24 bytes)
 * 57..72: Poly1305 tag (16 bytes), **not** included in the ciphertext passed to `open`
 * 73..: encrypted bytes only (`seal` output minus the trailing 16-byte tag)
 */
export function encryptCompactMessage(
    plaintextUtf8: string,
    recipientX25519PublicKey: Uint8Array,
    senderX25519SecretKey: Uint8Array,
    senderEd25519SecretKey: Uint8Array,
): Uint8Array {
    if (recipientX25519PublicKey.byteLength !== COMPACT_KEY_LEN) {
        throw new Error("Invalid recipient X25519 public key")
    }

    const ephemeralSecret = x25519.utils.randomSecretKey()
    const ephemeralPublic = x25519.getPublicKey(ephemeralSecret)
    const shared = x25519.getSharedSecret(
        ephemeralSecret,
        recipientX25519PublicKey,
    )
    const aeadKey = deriveAeadKey(shared)
    const plainBytes = new TextEncoder().encode(plaintextUtf8)
    const signature = ed25519.sign(plainBytes, senderEd25519SecretKey)

    if (signature.byteLength !== COMPACT_ED25519_SIG_LEN) {
        throw new Error("Unexpected Ed25519 signature length")
    }

    const inner = new Uint8Array(plainBytes.byteLength + signature.byteLength)

    inner.set(plainBytes, 0)
    inner.set(signature, plainBytes.byteLength)

    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN))
    const sealed = secretbox(aeadKey, nonce).seal(inner)

    if (sealed.byteLength < MAC_LEN) {
        throw new Error("Seal output too short")
    }

    const encPayload = sealed.subarray(0, sealed.byteLength - MAC_LEN)
    const mac = sealed.subarray(sealed.byteLength - MAC_LEN)
    const out = new Uint8Array(
        1 + COMPACT_KEY_LEN + NONCE_LEN + MAC_LEN + encPayload.byteLength,
    )
    let o = 0
    out[o++] = COMPACT_MESSAGE_VERSION
    out.set(ephemeralPublic, o)
    o += COMPACT_KEY_LEN
    out.set(nonce, o)
    o += NONCE_LEN
    out.set(mac, o)
    o += MAC_LEN
    out.set(encPayload, o)
    return out
}

export type CompactDecryptResult = {
    text: string
    signaturesValid: boolean
}

export function decryptCompactMessage(
    packet: Uint8Array,
    recipientX25519SecretKey: Uint8Array,
    senderEd25519PublicKey: Uint8Array,
): CompactDecryptResult {
    if (packet.byteLength < 1 + COMPACT_KEY_LEN + NONCE_LEN + MAC_LEN + 1) {
        throw new Error("Compact message packet too short")
    }

    if (packet[0] !== COMPACT_MESSAGE_VERSION) {
        throw new Error("Unsupported compact message version")
    }

    const ephemeralPublic = packet.subarray(1, 33)
    const nonce = packet.subarray(33, 57)
    const mac = packet.subarray(57, 73)
    const encPayload = packet.subarray(73)
    const sealed = new Uint8Array(encPayload.byteLength + mac.byteLength)

    sealed.set(encPayload, 0)
    sealed.set(mac, encPayload.byteLength)

    const shared = x25519.getSharedSecret(
        recipientX25519SecretKey,
        ephemeralPublic,
    )
    const aeadKey = deriveAeadKey(shared)
    let inner: Uint8Array

    try {
        inner = secretbox(aeadKey, nonce).open(sealed)
    } catch {
        throw new Error("Compact message failed to decrypt (wrong key or corrupt data)")
    }

    if (inner.byteLength < COMPACT_ED25519_SIG_LEN) {
        throw new Error("Compact message inner payload too short")
    }

    const sigStart = inner.byteLength - COMPACT_ED25519_SIG_LEN
    const plainBytes = inner.subarray(0, sigStart)
    const sig = inner.subarray(sigStart)
    const text = new TextDecoder().decode(plainBytes)
    let signaturesValid = false

    try {
        signaturesValid = ed25519.verify(sig, plainBytes, senderEd25519PublicKey)
    } catch {
        signaturesValid = false
    }

    return { text, signaturesValid }
}
