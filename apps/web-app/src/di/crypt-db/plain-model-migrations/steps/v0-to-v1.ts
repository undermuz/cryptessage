import type { CryptoProtocolId } from "../../crypto-protocol"
import { DEFAULT_CRYPTO_PROTOCOL } from "../../crypto-protocol"
import type { ContactPlainV1 } from "../../models/contact"
import type { MessagePlainV1 } from "../../models/message"
import type { PlainModelMigrationContext } from "../types"

function migrateContactV0ToV1(raw: unknown): ContactPlainV1 {
    const c = raw as ContactPlainV1 & { publicKeyArmored?: string }
    const cryptoProtocol: CryptoProtocolId =
        c.cryptoProtocol ?? DEFAULT_CRYPTO_PROTOCOL
    const legacy = c as ContactPlainV1 & { publicKeyArmored?: string }

    if (cryptoProtocol === "openpgp") {
        return {
            ...c,
            cryptoProtocol: "openpgp",
            publicKeyArmored: legacy.publicKeyArmored ?? "",
        }
    }

    return {
        ...c,
        cryptoProtocol: "compact_v1",
    }
}

function migrateMessageV0ToV1(raw: unknown): MessagePlainV1 {
    const m = raw as MessagePlainV1
    const cryptoProtocol: CryptoProtocolId =
        m.cryptoProtocol ?? DEFAULT_CRYPTO_PROTOCOL

    const channelPayload = m.channelPayload ?? ""
    const outboundSelfPayload = m.outboundSelfPayload
    const transportState = m.transportState
    const transportKind = m.transportKind
    const transportStatus = m.transportStatus

    return {
        ...m,
        cryptoProtocol,
        channelPayload,
        ...(outboundSelfPayload !== undefined ? { outboundSelfPayload } : {}),
        ...(m.direction === "out"
            ? {
                transportState: transportState ?? "sent",
                ...(transportKind !== undefined ? { transportKind } : {}),
                ...(transportStatus !== undefined ? { transportStatus } : {}),
            }
            : {}),
    }
}

/**
 * v0 → v1: default `cryptoProtocol`, OpenPGP `publicKeyArmored`, message
 * `channelPayload` / outbound transport defaults (flat records).
 */
export async function migratePlainModelV0ToV1(
    ctx: PlainModelMigrationContext,
): Promise<void> {
    await ctx.forEachContact((raw) => migrateContactV0ToV1(raw))
    await ctx.forEachMessage((raw) => migrateMessageV0ToV1(raw))
}
