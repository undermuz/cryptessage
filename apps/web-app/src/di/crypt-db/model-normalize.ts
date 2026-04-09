import type { CryptoProtocolId } from "./crypto-protocol"
import { DEFAULT_CRYPTO_PROTOCOL } from "./crypto-protocol"
import type { ContactPlain, MessagePlain } from "./types-data"

export function normalizeContact(c: ContactPlain): ContactPlain {
    const cryptoProtocol: CryptoProtocolId =
        c.cryptoProtocol ?? DEFAULT_CRYPTO_PROTOCOL
    const legacy = c as ContactPlain & { publicKeyArmored?: string }

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

export function normalizeMessage(m: MessagePlain): MessagePlain {
    const cryptoProtocol: CryptoProtocolId =
        m.cryptoProtocol ?? DEFAULT_CRYPTO_PROTOCOL

    const channelPayload = m.channelPayload ?? ""
    const outboundSelfPayload = m.outboundSelfPayload

    return {
        ...m,
        cryptoProtocol,
        channelPayload,
        ...(outboundSelfPayload !== undefined ? { outboundSelfPayload } : {}),
    }
}
