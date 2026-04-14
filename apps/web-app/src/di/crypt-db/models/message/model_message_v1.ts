import type { CryptoProtocolId } from "../../crypto-protocol"
import type { MessageDirection, MessageTransportState } from "./message-enums"

/** Flat message record as stored after plain-model step 0. */
export type MessagePlainV1 = {
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
    /** For `out` only: best-effort delivery status. */
    transportState?: MessageTransportState
    /** For `out` only: transport kind used when delivered (if known). */
    transportKind?: string
    /** For `out` only: last HTTP status or transport status (if known). */
    transportStatus?: number
}
