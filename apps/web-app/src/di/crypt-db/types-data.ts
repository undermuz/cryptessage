import type { CryptoProtocolId } from "./crypto-protocol"

export type ContactPlain = {
    id: string
    displayName: string
    createdAt: number
    cryptoProtocol: CryptoProtocolId
    /** OpenPGP armored public key when `cryptoProtocol` is `openpgp`. */
    publicKeyArmored?: string
    /** Base64, 32 bytes — recipient X25519 public key for `compact_v1`. */
    compactX25519PublicKeyB64?: string
    /** Base64, 32 bytes — recipient Ed25519 public key for `compact_v1`. */
    compactEd25519PublicKeyB64?: string
}

export type MessageDirection = "in" | "out"

export type MessagePlain = {
    id: string
    contactId: string
    direction: MessageDirection
    createdAt: number
    cryptoProtocol: CryptoProtocolId
    /**
     * Ciphertext for the contact channel: OpenPGP armored ASCII, or base64(raw bytes)
     * for compact binary v0x02 (optionally wrapped in CMK1 for QR only; storage uses raw v0x02 base64).
     */
    channelPayload: string
    /**
     * For `out` only: ciphertext decryptable by this device (encrypt-to-self),
     * same encoding rules as `channelPayload`.
     */
    outboundSelfPayload?: string
    /** Legacy OpenPGP field — migrated to `channelPayload` via normalize. */
    armoredPayload?: string
    outboundSelfArmored?: string
}

export type CompactIdentitySecrets = {
    x25519PublicKeyB64: string
    x25519SecretKeyB64: string
    ed25519PublicKeyB64: string
    ed25519SecretKeyB64: string
}

export type IdentityPlain = {
    publicKeyArmored: string
    privateKeyArmored: string
    /** NaCl-style compact keys for `compact_v1`; added by migration. */
    compactIdentity?: CompactIdentitySecrets
}
