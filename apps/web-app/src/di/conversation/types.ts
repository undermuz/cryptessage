import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"
import type { ContactPlain, MessagePlain } from "@/di/crypt-db/types-data"

export const ConversationService = Symbol.for("ConversationService")

export type IConversationService = {
    addContactFromVisitCard(
        rawCard: VisitCardRawPayload,
        displayNameOverride?: string,
    ): Promise<ContactPlain>
    listContacts(): Promise<ContactPlain[]>
    getContact(id: string): Promise<ContactPlain | null>
    deleteContact(id: string): Promise<void>
    encryptOutgoingMessage(contactId: string, plaintext: string): Promise<string>
    saveOutboundArmored(contactId: string, armored: string): Promise<MessagePlain>
    saveInboundArmored(contactId: string, armored: string): Promise<MessagePlain>
    listMessages(contactId: string): Promise<MessagePlain[]>
}
