import { inject, injectable } from "inversify"

import type { ContactPlain, MessagePlain } from "@/di/crypt-db/types-data"
import {
    MessagingCryptoService,
    type IMessagingCryptoService,
} from "@/di/messaging-crypto/types"

import type {
    DecryptedMessageItem,
    DecryptPreviewState,
    IChatThreadDecryptService,
} from "./types"

@injectable()
export class ChatThreadDecryptProvider implements IChatThreadDecryptService {
    @inject(MessagingCryptoService)
    private readonly messaging!: IMessagingCryptoService

    public async decryptOne(
        contact: ContactPlain,
        m: MessagePlain,
        signal?: AbortSignal,
    ): Promise<DecryptPreviewState | null> {
        if (signal?.aborted) {
            return null
        }

        if (m.direction === "out") {
            const selfPl = m.outboundSelfPayload

            if (!selfPl) {
                return { ok: false, err: "missing self payload" }
            }

            try {
                const r = await this.messaging.decryptOutboundSelf(
                    selfPl,
                    m.cryptoProtocol,
                )

                if (signal?.aborted) {
                    return null
                }

                return { ok: true, text: r.text, sig: r.signaturesValid }
            } catch (e) {
                const err = e instanceof Error ? e.message : String(e)

                return { ok: false, err }
            }
        }

        try {
            const r = await this.messaging.decryptIncoming(
                contact,
                m.channelPayload,
                m.cryptoProtocol,
            )

            if (signal?.aborted) {
                return null
            }

            return { ok: true, text: r.text, sig: r.signaturesValid }
        } catch (e) {
            const err = e instanceof Error ? e.message : String(e)

            return { ok: false, err }
        }
    }

    public async decryptList(
        contact: ContactPlain,
        messages: MessagePlain[],
        signal?: AbortSignal,
    ): Promise<DecryptedMessageItem[]> {
        const decrypted = await Promise.all(
            messages.map(async (m) => ({
                message: m,
                decrypted: await this.decryptOne(contact, m, signal),
            })),
        )

        if (signal?.aborted) {
            throw new DOMException("AbortError")
        }

        return decrypted
    }
}

