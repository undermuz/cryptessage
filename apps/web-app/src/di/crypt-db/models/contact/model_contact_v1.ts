import type { CryptoProtocolId } from "../../crypto-protocol"

/** Flat contact record as stored after plain-model step 0 (legacy normalization). */
export type ContactPlainV1 = {
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
    /**
     * Ordered transport profile instance ids for this contact (fallback chain).
     * When unset, global defaults from transport prefs apply.
     */
    transportInstanceOrder?: string[]
    /** Overrides global default transport instance for this contact. */
    preferredTransportInstanceId?: string
    /**
     * Opaque recipient key id for `http_rest_v1` POST .../inbox/{id} (out-of-band).
     */
    httpRestInboxRecipientKeyId?: string
}
