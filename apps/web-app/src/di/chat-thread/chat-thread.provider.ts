import { inject, injectable } from "inversify"
import { BrowserQRCodeReader } from "@zxing/browser"
import { proxy } from "valtio"

import {
    ConversationService,
    type IConversationService,
} from "@/di/conversation/types"
import { I18nProvider, type I18nService } from "@/di/i18n/types"
import {
    MessagingCryptoService,
    type EncryptedOutgoingBundle,
    type IMessagingCryptoService,
} from "@/di/messaging-crypto/types"
import {
    EventBusProvider,
    type IEventObserver,
} from "@/di/utils/event-bus/types"
import {
    PromiseManagerProvider,
    type PromiseManager,
} from "@/di/utils/promise-manager/types"
import type { MessagePlain } from "@/di/crypt-db/types-data"
import {
    decodeQrFromClipboardImage,
    decodeQrFromImageBlob,
} from "@/lib/qr-zxing/clipboard-qr"

import { PAGE_SIZE, VIEW_COUNT } from "./constants"
import type {
    ChatThreadImportState,
    ChatThreadState,
    IChatThreadService,
} from "./types"
import { isCiphertextForRecipientNotSelf } from "./utils"
import { invariant } from "@/lib/utils"

type ChatThreadPromiseEvents = {
    "chatThread:loadContact": void
    "chatThread:decryptImport": void
    "chatThread:onSendNewMessage": EncryptedOutgoingBundle
    "chatThread:applyImport": boolean
    "chatThread:importByQrClipboard": void
    "chatThread:importByQrFile": void
}

type ChatThreadEventBusEvents = {
    "chatThread:toast": [message: string]
}

@injectable()
export class ChatThreadProvider implements IChatThreadService {
    public readonly state: ChatThreadState

    @inject(ConversationService)
    private readonly conv!: IConversationService

    @inject(MessagingCryptoService)
    private readonly messaging!: IMessagingCryptoService

    @inject(I18nProvider)
    private readonly i18n!: I18nService

    @inject(EventBusProvider)
    private readonly events!: IEventObserver<ChatThreadEventBusEvents>

    @inject(PromiseManagerProvider)
    private readonly pm!: PromiseManager<
        ChatThreadPromiseEvents,
        keyof ChatThreadPromiseEvents
    >

    constructor(contactId: string | null = null) {
        this.state = proxy(
            ChatThreadProvider.createInitialChatThreadState(contactId),
        )
    }

    private abortPromises(): void {
        this.pm.abort("chatThread:loadContact")
        this.pm.abort("chatThread:decryptImport")
        this.pm.abort("chatThread:onSendNewMessage")
        this.pm.abort("chatThread:applyImport")
        this.pm.abort("chatThread:importByQrClipboard")
        this.pm.abort("chatThread:importByQrFile")
    }

    static createInitialChatThreadState(
        contactId: string | null = null,
    ): ChatThreadState {
        return {
            contactId,
            contact: null,
            isPendingList: false,
            fullMessages: [],
            listItems: [],
            import: {
                data: null,
                pending: false,
                decrypted: null,
                error: null,
            },
            inboundDecrypted: {},
            outboundDecrypted: {},
            pendingScrollToBottom: false,
        }
    }

    private setMessages(all: MessagePlain[]): void {
        this.state.fullMessages = all
        this.state.listItems = all.slice(-VIEW_COUNT)
    }

    private resetState(contactId: string | null): void {
        Object.assign(
            this.state,
            ChatThreadProvider.createInitialChatThreadState(contactId),
        )
    }

    public setListItems(items: MessagePlain[]): void {
        this.state.listItems = items
    }

    private emitToast(message: string): void {
        this.events.emit("chatThread:toast", message)
    }

    public clearPendingScrollToBottom(): void {
        this.state.pendingScrollToBottom = false
    }

    public jumpListToBottom(): void {
        this.state.listItems = this.state.fullMessages.slice(-VIEW_COUNT)
        this.state.pendingScrollToBottom = true
    }

    private async _loadContact(
        contactId: string,
        signal: AbortSignal,
    ): Promise<void> {
        invariant(Boolean(contactId), "Invalid contact ID")

        try {
            if (signal.aborted) return

            const c = await this.conv.getContact(contactId)

            if (signal.aborted) return

            this.state.contact = c
            this.state.isPendingList = true

            const all = await this.conv.listMessages(contactId)

            if (signal.aborted) return

            this.setMessages(all)

            await this.decryptMessages(signal)
        } finally {
            if (!signal.aborted) {
                this.state.pendingScrollToBottom = true
                this.state.isPendingList = false
            }
        }
    }

    private async loadContact(contactId: string): Promise<void> {
        const { promise } = this.pm.takeLatest(
            "chatThread:loadContact",
            (signal) => this._loadContact(contactId, signal),
        )

        return promise
    }

    public async setActiveContactId(contactId: string | null): Promise<void> {
        this.abortPromises()

        this.resetState(contactId)

        if (!contactId) {
            return
        }

        return this.loadContact(contactId)
    }

    public async reload(): Promise<void> {
        const contactId = this.state.contactId

        if (!contactId) {
            return
        }

        await this.loadContact(contactId)
    }

    public async onSendNewMessage(
        messageText: string,
    ): Promise<EncryptedOutgoingBundle> {
        const { promise } = this.pm.createExclusive(
            "chatThread:onSendNewMessage",
            async (signal) => {
                invariant(messageText.trim().length > 0, "Invalid plain text")

                const contactId = this.state.contactId
                const contact = this.state.contact

                invariant(contactId !== null, "Invalid contact ID")
                invariant(contact !== null, "Invalid contact")

                if (signal.aborted) {
                    throw new DOMException("AbortError")
                }

                const bundle = await this.conv.encryptOutgoingBundle(
                    contactId,
                    messageText,
                )

                if (signal.aborted) {
                    throw new DOMException("AbortError")
                }

                await this.conv.saveOutboundBundle(contactId, bundle)
                await this.reload()

                return bundle
            },
        )

        try {
            return await promise
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                throw e
            }

            const raw = e instanceof Error ? e.message : String(e)

            this.emitToast(raw)

            throw e
        }
    }

    public async applyImport(): Promise<boolean> {
        const { promise } = this.pm.createExclusive(
            "chatThread:applyImport",
            async (signal) => {
                const imp = this.state.import
                const data = imp.data
                const contact = this.state.contact

                invariant(data !== null, "Invalid import data")
                invariant(contact !== null, "Invalid contact")

                if (signal.aborted) {
                    throw new DOMException("AbortError")
                }

                const normalized = await this.messaging.normalizeInboundPayload(
                    data.raw,
                )

                if (signal.aborted) {
                    throw new DOMException("AbortError")
                }

                await this.conv.saveInboundPayload(
                    contact.id,
                    normalized.channelStorage,
                    normalized.cryptoProtocol,
                )

                imp.data = null
                imp.decrypted = null
                imp.error = null

                await this.reload()

                this.emitToast(this.i18n.t("chat.saveInboundOk"))

                return true
            },
        )

        try {
            return await promise
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                return false
            }

            const reason = e instanceof Error ? e.message : String(e)

            this.emitToast(this.i18n.t("chat.saveInboundFail", { reason }))

            return false
        }
    }

    public async importByRaw(payload: string): Promise<void> {
        const contact = this.state.contact

        if (!contact) {
            return
        }

        const rawPaste = payload.trim()

        try {
            await this.setImportData({ raw: rawPaste, source: "manual" })

            this.emitToast(this.i18n.t("chat.saveInboundOk"))
        } catch (e) {
            const raw = e instanceof Error ? e.message : String(e)

            this.emitToast(
                isCiphertextForRecipientNotSelf(raw)
                    ? this.i18n.t("chat.errCannotDecryptOwnOutgoing")
                    : raw,
            )
        }
    }

    public async importByQrClipboard(): Promise<void> {
        const { promise } = this.pm.takeLatest(
            "chatThread:importByQrClipboard",
            async (signal) => {
                const reader = new BrowserQRCodeReader()
                const payload = await decodeQrFromClipboardImage(reader)

                if (signal.aborted) {
                    return
                }

                if (!payload) {
                    this.emitToast(this.i18n.t("contacts.pasteQrNoCode"))
                    return
                }

                await this.setImportData({ raw: payload, source: "clipboard" })
            },
        )

        try {
            await promise
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                return
            }

            const reason = e instanceof Error ? e.message : String(e)

            this.emitToast(this.i18n.t("contacts.pasteQrFailed", { reason }))
        }
    }

    public async importByQrFile(file: File): Promise<void> {
        const { promise } = this.pm.takeLatest(
            "chatThread:importByQrFile",
            async (signal) => {
                const reader = new BrowserQRCodeReader()
                const payload = await decodeQrFromImageBlob(reader, file)

                if (signal.aborted) {
                    return
                }

                if (!payload) {
                    this.emitToast(this.i18n.t("contacts.pasteQrNoCode"))
                    return
                }

                await this.setImportData({ raw: payload, source: "file" })
            },
        )

        try {
            await promise
        } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
                return
            }

            const reason = e instanceof Error ? e.message : String(e)

            this.emitToast(this.i18n.t("contacts.pasteQrFailed", { reason }))
        }
    }

    public async setImportData(
        data: ChatThreadImportState["data"],
    ): Promise<void> {
        const imp = this.state.import

        imp.data = data

        if (!data || !this.state.contact) {
            imp.pending = false
            imp.decrypted = null
            imp.data = null

            const error = "Invalid import data"

            imp.error = error

            throw new Error(error)
        }

        const { promise } = this.pm.takeLatest(
            "chatThread:decryptImport",
            (signal) => this.decryptImport(signal),
        )

        return promise
    }

    private async decryptImport(signal: AbortSignal): Promise<void> {
        const imp = this.state.import
        const data = imp.data
        const contact = this.state.contact

        invariant(data !== null, "Invalid import data")
        invariant(contact !== null, "Invalid contact")

        imp.pending = true
        imp.decrypted = null
        imp.error = null

        try {
            if (signal.aborted) {
                return
            }

            const r = await this.messaging.decryptIncoming(
                contact,
                data.raw,
                contact.cryptoProtocol,
            )

            if (signal.aborted) {
                return
            }

            imp.decrypted = r
            imp.error = null
        } catch (e) {
            if (signal.aborted) {
                return
            }

            imp.decrypted = null

            const raw = e instanceof Error ? e.message : String(e)

            imp.error = isCiphertextForRecipientNotSelf(raw)
                ? this.i18n.t("chat.errCannotDecryptOwnOutgoing")
                : raw
        } finally {
            if (!signal.aborted) {
                imp.pending = false
            }
        }
    }

    private async decryptMessages(signal: AbortSignal): Promise<void> {
        const contact = this.state.contact
        const messages = this.state.fullMessages

        if (!contact) {
            this.state.inboundDecrypted = {}

            return
        }

        if (signal.aborted) {
            return
        }

        const inbound = messages.filter((m) => m.direction === "in")

        if (inbound.length === 0) {
            this.state.inboundDecrypted = {}
        } else {
            const inboundEntries = await Promise.all(
                inbound.map(async (m) => {
                    if (signal.aborted) {
                        return [m.id, { ok: false, err: "aborted" }] as const
                    }

                    try {
                        const r = await this.messaging.decryptIncoming(
                            contact,
                            m.channelPayload,
                            m.cryptoProtocol,
                        )

                        return [
                            m.id,
                            {
                                ok: true,
                                text: r.text,
                                sig: r.signaturesValid,
                            },
                        ] as const
                    } catch (e) {
                        const err = e instanceof Error ? e.message : String(e)

                        return [m.id, { ok: false, err }] as const
                    }
                }),
            )

            if (signal.aborted) {
                return
            }

            this.state.inboundDecrypted = Object.fromEntries(inboundEntries)
        }

        const outbound = messages.filter((m) => m.direction === "out")

        if (outbound.length === 0) {
            this.state.outboundDecrypted = {}

            return
        }

        if (signal.aborted) {
            return
        }

        const outboundEntries = await Promise.all(
            outbound.map(async (m) => {
                if (signal.aborted) {
                    return [m.id, { ok: false, err: "aborted" }] as const
                }

                const selfPl = m.outboundSelfPayload

                if (!selfPl) {
                    return [
                        m.id,
                        { ok: false, err: "missing self payload" },
                    ] as const
                }

                try {
                    const r = await this.messaging.decryptOutboundSelf(
                        selfPl,
                        m.cryptoProtocol,
                    )

                    return [
                        m.id,
                        {
                            ok: true,
                            text: r.text,
                            sig: r.signaturesValid,
                        },
                    ] as const
                } catch (e) {
                    const err = e instanceof Error ? e.message : String(e)

                    return [m.id, { ok: false, err }] as const
                }
            }),
        )

        if (signal.aborted) {
            return
        }

        this.state.outboundDecrypted = Object.fromEntries(outboundEntries)
    }

    public async loadMore(
        direction: "up" | "down",
        refItem: MessagePlain,
    ): Promise<MessagePlain[]> {
        const full = this.state.fullMessages
        const idx = full.findIndex((m) => m.id === refItem.id)

        if (idx === -1) {
            return []
        }

        if (direction === "up") {
            const start = Math.max(0, idx - PAGE_SIZE)

            return full.slice(start, idx)
        }

        const end = Math.min(full.length, idx + PAGE_SIZE + 1)

        return full.slice(idx + 1, end)
    }
}
