import type { CryptoProtocolId } from "@/di/crypt-db/crypto-protocol"
import type { ContactPlain } from "@/di/crypt-db/types-data"
import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"

export const MessagingCryptoService = Symbol.for("MessagingCryptoService")

export type EncryptedOutgoingBundle = {
    channelStorage: string
    outboundSelfStorage: string
    /** Wrapped for QR (CMM1 or CMK1). */
    qrPayloadBinary: Uint8Array
}

export type ScannedPayloadNormalized = {
    channelStorage: string
    cryptoProtocol: CryptoProtocolId
}

export type IMessagingCryptoService = {
    encryptOutgoing(
        contact: ContactPlain,
        plaintext: string,
    ): Promise<EncryptedOutgoingBundle>
    decryptIncoming(
        contact: ContactPlain,
        channelPayload: string | Uint8Array,
        messageProtocol: CryptoProtocolId,
    ): Promise<{ text: string; signaturesValid: boolean }>
    /** Convert scanned / pasted ciphertext to persisted `channelPayload` + protocol. */
    normalizeInboundPayload(
        raw: VisitCardRawPayload,
    ): Promise<ScannedPayloadNormalized>
    /**
     * Try contacts (same protocol as normalized payload) until `decryptIncoming` succeeds.
     * Used when the transport does not identify the sender (e.g. HTTP outbox).
     */
    tryResolveInboundContact(
        raw: VisitCardRawPayload,
        contacts: ContactPlain[],
    ): Promise<ScannedPayloadNormalized & { contactId: string } | null>
    decryptOutboundSelf(
        channelPayload: string,
        messageProtocol: CryptoProtocolId,
    ): Promise<{ text: string; signaturesValid: boolean }>
}
