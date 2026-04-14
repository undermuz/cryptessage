import type { CryptoProtocolId } from "../../crypto-protocol"
import type { MessageDirection, MessageTransportState } from "./message-enums"

export type MessageCrypto = {
    protocol: CryptoProtocolId
    channelPayload: string
    /** For `out` only: encrypt-to-self payload. */
    outboundSelfPayload?: string
}

export type MessageTransport = {
    state?: MessageTransportState
    kind?: string
    status?: number
}

export type MessagePlain = {
    id: string
    contactId: string
    direction: MessageDirection
    createdAt: number
    crypto: MessageCrypto
    /** Present for outbound messages when transport metadata exists. */
    transport?: MessageTransport
}
