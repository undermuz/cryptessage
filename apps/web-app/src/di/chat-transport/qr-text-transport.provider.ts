import { inject, injectable } from "inversify"

import { QR_TEXT_TRANSPORT_KIND } from "./constants"
import {
    ChatTransportOutgoingStore,
    type IChatTransport,
    type IChatTransportOutgoingStore,
    type RecipientTransportMeta,
    type SenderTransportMeta,
    type Unsubscribe,
} from "./types"

function u8eq(a: Uint8Array, b: Uint8Array): boolean {
    if (a.byteLength !== b.byteLength) {
        return false
    }

    for (let i = 0; i < a.byteLength; i++) {
        if (a[i] !== b[i]) {
            return false
        }
    }

    return true
}

@injectable()
export class QrTextTransportProvider implements IChatTransport {
    public readonly kind = QR_TEXT_TRANSPORT_KIND

    public readonly capabilities = {
        supportsPush: false,
        requiresUserActionForSend: true,
        supportsSubscribe: false,
    } as const

    @inject(ChatTransportOutgoingStore)
    private readonly outgoing!: IChatTransportOutgoingStore

    public parseConfig(raw: unknown): unknown {
        if (raw === undefined || raw === null) {
            return {}
        }

        if (typeof raw === "object" && !Array.isArray(raw)) {
            return raw as Record<string, unknown>
        }

        throw new Error("QrTextTransport: config must be an object or empty")
    }

    public async send(
        payload: Uint8Array,
        meta: RecipientTransportMeta,
        _instanceConfig: unknown,
    ): Promise<void> {
        const pending = this.outgoing.state.pending

        if (!pending || pending.contactId !== meta.contactId) {
            throw new Error("QrTextTransport: no pending outgoing for contact")
        }

        if (!u8eq(pending.bundle.qrPayloadBinary, payload)) {
            throw new Error("QrTextTransport: payload does not match pending")
        }
    }

    public subscribe(
        _handler: (data: Uint8Array, meta: SenderTransportMeta) => void,
        _instanceConfig: unknown,
    ): Unsubscribe {
        return () => {
            void 0
        }
    }

    public forceReceive(
        _handler: (data: Uint8Array, meta: SenderTransportMeta) => void,
        _instanceConfig: unknown,
    ): void {
        /* Receiving uses the existing chat import / scan flow (see manager.openQrReceiveFallback). */
    }
}
