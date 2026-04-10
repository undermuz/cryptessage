import type { ContactPlain } from "@/di/crypt-db/types-data"

import type { RecipientTransportMeta } from "./types"

export function buildRecipientTransportMeta(
    contact: ContactPlain,
): RecipientTransportMeta {
    const base: RecipientTransportMeta = {
        contactId: contact.id,
        cryptoProtocol: contact.cryptoProtocol,
    }

    const httpId =
        contact.httpRestInboxRecipientKeyId !== undefined
            ? { httpRestInboxRecipientKeyId: contact.httpRestInboxRecipientKeyId }
            : {}

    if (contact.cryptoProtocol === "compact_v1") {
        return {
            ...base,
            compactX25519PublicKeyB64: contact.compactX25519PublicKeyB64,
            compactEd25519PublicKeyB64: contact.compactEd25519PublicKeyB64,
            ...httpId,
        }
    }

    return {
        ...base,
        publicKeyArmored: contact.publicKeyArmored,
        ...httpId,
    }
}
