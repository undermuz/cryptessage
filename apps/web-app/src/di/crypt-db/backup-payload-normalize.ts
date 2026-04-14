import {
    migrateContactV1ToV2,
    migrateIdentityV1ToV2,
    migrateMessageV1ToV2,
} from "./plain-model-migrations/steps/v1-to-v2"
import type {
    ContactPlain,
    ContactPlainV1,
    IdentityPlain,
    IdentityPlainV1,
    MessagePlain,
    MessagePlainV1,
} from "./models"

function isContactPlainV1(c: unknown): c is ContactPlainV1 {
    return (
        typeof c === "object" &&
        c !== null &&
        "cryptoProtocol" in c &&
        !("crypto" in c)
    )
}

function isMessagePlainV1(m: unknown): m is MessagePlainV1 {
    return (
        typeof m === "object" &&
        m !== null &&
        "cryptoProtocol" in m &&
        !("crypto" in m)
    )
}

function isIdentityPlainV1(id: unknown): id is IdentityPlainV1 {
    return (
        typeof id === "object" &&
        id !== null &&
        "publicKeyArmored" in id &&
        !("openpgp" in id)
    )
}

/**
 * Accepts backup/rest payload that may still use flat v1 JSON and returns current models.
 */
export function normalizeBackupPlainPayload(input: unknown): {
    contacts: ContactPlain[]
    messages: MessagePlain[]
    identity: IdentityPlain
} {
    if (!input || typeof input !== "object") {
        throw new Error("Invalid backup payload")
    }

    const { contacts, messages, identity } = input as Record<string, unknown>

    if (!Array.isArray(contacts) || !Array.isArray(messages)) {
        throw new Error("Invalid backup payload")
    }

    if (!identity || typeof identity !== "object") {
        throw new Error("Invalid backup payload")
    }

    const nextContacts = contacts.map((c) =>
        isContactPlainV1(c) ? migrateContactV1ToV2(c) : (c as ContactPlain),
    )
    const nextMessages = messages.map((m) =>
        isMessagePlainV1(m) ? migrateMessageV1ToV2(m) : (m as MessagePlain),
    )
    const nextIdentity = isIdentityPlainV1(identity)
        ? migrateIdentityV1ToV2(identity)
        : (identity as IdentityPlain)

    return {
        contacts: nextContacts,
        messages: nextMessages,
        identity: nextIdentity,
    }
}
