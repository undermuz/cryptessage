import type { ContactPlain } from "@/di/crypt-db/types-data"

import type { RecipientTransportMeta } from "./types"

export function buildRecipientTransportMeta(
    contact: ContactPlain,
): RecipientTransportMeta {
    const base: RecipientTransportMeta = {
        contactId: contact.id,
        cryptoProtocol: contact.crypto.protocol,
    }

    const httpId =
        contact.transport?.httpRestInboxRecipientKeyId !== undefined
            ? {
                httpRestInboxRecipientKeyId:
                    contact.transport.httpRestInboxRecipientKeyId,
            }
            : {}

    if (contact.crypto.protocol === "compact_v1") {
        return {
            ...base,
            compactX25519PublicKeyB64: contact.crypto.compact.x25519PublicKeyB64,
            compactEd25519PublicKeyB64: contact.crypto.compact.ed25519PublicKeyB64,
            ...httpId,
        }
    }

    return {
        ...base,
        publicKeyArmored: contact.crypto.openpgp.publicKeyArmored,
        ...httpId,
    }
}
