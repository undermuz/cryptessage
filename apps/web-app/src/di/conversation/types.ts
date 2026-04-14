import type { CryptoProtocolId } from "@/di/crypt-db/crypto-protocol"
import type {
    ContactPlain,
    MessagePlain,
    MessageTransportState,
} from "@/di/crypt-db/types-data"
import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"
import type { EncryptedOutgoingBundle } from "@/di/messaging-crypto/types"

export const ConversationService = Symbol.for("ConversationService")

export type VisitCardInterpretation = "auto" | "openpgp" | "compact_v1"

export type IConversationService = {
    addContactFromVisitCard(
        rawCard: VisitCardRawPayload,
        displayNameOverride?: string,
        interpretation?: VisitCardInterpretation,
    ): Promise<ContactPlain>
    listContacts(): Promise<ContactPlain[]>
    getContact(id: string): Promise<ContactPlain | null>
    saveContact(c: ContactPlain): Promise<void>
    deleteContact(id: string): Promise<void>
    encryptOutgoingBundle(
        contactId: string,
        plaintext: string,
    ): Promise<EncryptedOutgoingBundle>
    saveOutboundBundle(
        contactId: string,
        bundle: EncryptedOutgoingBundle,
    ): Promise<MessagePlain>
    setOutboundTransportState(
        messageId: string,
        state: MessageTransportState | undefined,
        detail?: { kind?: string; status?: number },
    ): Promise<void>
    saveInboundPayload(
        contactId: string,
        channelPayload: string,
        cryptoProtocol: CryptoProtocolId,
    ): Promise<MessagePlain>
    listMessages(contactId: string): Promise<MessagePlain[]>
}
