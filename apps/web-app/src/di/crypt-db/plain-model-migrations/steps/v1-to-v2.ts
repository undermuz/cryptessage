import type { ContactPlain, ContactPlainV1, ContactTransport } from "../../models/contact"
import type { IdentityPlain, IdentityPlainV1 } from "../../models/identity"
import type { MessagePlain, MessagePlainV1 } from "../../models/message"
import type { PlainModelMigrationContext } from "../types"

function contactTransportFromV1(c: ContactPlainV1): ContactTransport | undefined {
    const t: ContactTransport = {}

    if (c.transportInstanceOrder !== undefined) {
        t.instanceOrder = c.transportInstanceOrder
    }

    if (c.preferredTransportInstanceId !== undefined) {
        t.preferredInstanceId = c.preferredTransportInstanceId
    }

    if (c.httpRestInboxRecipientKeyId !== undefined) {
        t.httpRestInboxRecipientKeyId = c.httpRestInboxRecipientKeyId
    }

    return Object.keys(t).length > 0 ? t : undefined
}

export function migrateContactV1ToV2(c: ContactPlainV1): ContactPlain {
    const transport = contactTransportFromV1(c)

    if (c.cryptoProtocol === "openpgp") {
        return {
            id: c.id,
            displayName: c.displayName,
            createdAt: c.createdAt,
            crypto: {
                protocol: "openpgp",
                openpgp: { publicKeyArmored: c.publicKeyArmored ?? "" },
            },
            ...(transport ? { transport } : {}),
        }
    }

    return {
        id: c.id,
        displayName: c.displayName,
        createdAt: c.createdAt,
        crypto: {
            protocol: "compact_v1",
            compact: {
                x25519PublicKeyB64: c.compactX25519PublicKeyB64,
                ed25519PublicKeyB64: c.compactEd25519PublicKeyB64,
            },
        },
        ...(transport ? { transport } : {}),
    }
}

export function migrateMessageV1ToV2(m: MessagePlainV1): MessagePlain {
    let transport: MessagePlain["transport"]

    if (
        m.direction === "out" &&
        (m.transportState !== undefined ||
            m.transportKind !== undefined ||
            m.transportStatus !== undefined)
    ) {
        transport = {
            ...(m.transportState !== undefined ? { state: m.transportState } : {}),
            ...(m.transportKind !== undefined ? { kind: m.transportKind } : {}),
            ...(m.transportStatus !== undefined ? { status: m.transportStatus } : {}),
        }
    }

    const hasTransport =
        transport &&
        (transport.state !== undefined ||
            transport.kind !== undefined ||
            transport.status !== undefined)

    return {
        id: m.id,
        contactId: m.contactId,
        direction: m.direction,
        createdAt: m.createdAt,
        crypto: {
            protocol: m.cryptoProtocol,
            channelPayload: m.channelPayload,
            ...(m.outboundSelfPayload !== undefined
                ? { outboundSelfPayload: m.outboundSelfPayload }
                : {}),
        },
        ...(hasTransport ? { transport } : {}),
    }
}

export function migrateIdentityV1ToV2(id: IdentityPlainV1): IdentityPlain {
    return {
        openpgp: {
            publicKeyArmored: id.publicKeyArmored,
            privateKeyArmored: id.privateKeyArmored,
        },
        ...(id.compactIdentity ? { compact: id.compactIdentity } : {}),
    }
}

/**
 * v1 → v2: nest `crypto` / `transport` on contacts and messages; nest OpenPGP keys on identity.
 */
export async function migratePlainModelV1ToV2(
    ctx: PlainModelMigrationContext,
): Promise<void> {
    await ctx.forEachContact((raw) => migrateContactV1ToV2(raw as ContactPlainV1))
    await ctx.forEachMessage((raw) => migrateMessageV1ToV2(raw as MessagePlainV1))

    if (ctx.forEachIdentity) {
        await ctx.forEachIdentity((raw) =>
            migrateIdentityV1ToV2(raw as IdentityPlainV1),
        )
    }
}
