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

@injectable()
export class ChatThreadProvider implements IChatThreadService {
    public readonly state: ChatThreadState

    @inject(ConversationService)
    private readonly conv!: IConversationService

    @inject(MessagingCryptoService)
    private readonly messaging!: IMessagingCryptoService

    @inject(I18nProvider)
    private readonly i18n!: I18nService

    private loadGen = 0
    private importDecryptGen = 0

    constructor(contactId: string | null = null) {
        this.state = proxy(
            ChatThreadProvider.createInitialChatThreadState(contactId),
        )
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
            toast: null,
            import: {
                data: null,
                decryptLoading: false,
                decryptPreview: null,
                decryptErr: null,
            },
            inboundPreview: {},
            outboundPreview: {},
            pendingScrollToBottom: false,
        }
    }

    private async loadContact(contactId: string): Promise<void> {
        const gen = ++this.loadGen

        invariant(Boolean(contactId), "Invalid contact ID")

        try {
            const c = await this.conv.getContact(contactId)

            if (gen !== this.loadGen) {
                return
            }

            this.state.contact = c

            this.state.isPendingList = true

            const all = await this.conv.listMessages(contactId)

            if (gen !== this.loadGen) {
                return
            }

            await this.setMessages(all)
        } finally {
            if (gen === this.loadGen) {
                this.state.pendingScrollToBottom = true
                this.state.isPendingList = false
            }
        }
    }

    public async setActiveContactId(contactId: string | null): Promise<void> {
        Object.assign(
            this.state,
            ChatThreadProvider.createInitialChatThreadState(contactId),
        )

        if (!contactId) {
            return
        }

        await this.loadContact(contactId)
    }

    public async setImportData(
        data: ChatThreadImportState["data"],
    ): Promise<void> {
        const imp = this.state.import

        imp.data = data

        if (!data || !this.state.contact) {
            imp.decryptLoading = false
            imp.decryptPreview = null
            imp.decryptErr = null

            return
        }

        await this.decryptImport()
    }

    public setListItems(items: MessagePlain[]): void {
        this.state.listItems = items
    }

    public clearToast(): void {
        this.state.toast = null
    }

    public setToast(message: string | null): void {
        this.state.toast = message
    }

    public clearPendingScrollToBottom(): void {
        this.state.pendingScrollToBottom = false
    }

    public jumpListToBottom(): void {
        this.state.listItems = this.state.fullMessages.slice(-VIEW_COUNT)
        this.state.pendingScrollToBottom = true
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
        invariant(messageText.trim().length > 0, "Invalid plain text")

        const contactId = this.state.contactId
        const contact = this.state.contact

        invariant(contactId !== null, "Invalid contact ID")
        invariant(contact !== null, "Invalid contact")

        this.state.toast = null

        try {
            const bundle = await this.conv.encryptOutgoingBundle(
                contactId,
                messageText,
            )

            await this.conv.saveOutboundBundle(contactId, bundle)
            await this.reload()

            return bundle
        } catch (e) {
            const raw = e instanceof Error ? e.message : String(e)

            this.state.toast = raw

            throw e
        }
    }

    public async applyImport(): Promise<boolean> {
        const imp = this.state.import
        const data = imp.data
        const contact = this.state.contact

        invariant(data !== null, "Invalid import data")
        invariant(contact !== null, "Invalid contact")

        this.state.toast = null

        try {
            const normalized = await this.messaging.normalizeInboundPayload(
                data.raw,
            )

            await this.conv.saveInboundPayload(
                contact.id,
                normalized.channelStorage,
                normalized.cryptoProtocol,
            )

            imp.data = null
            imp.decryptPreview = null
            imp.decryptErr = null

            await this.reload()

            this.state.toast = this.i18n.t("chat.saveInboundOk")

            return true
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)

            this.state.toast = this.i18n.t("chat.saveInboundFail", { reason })

            return false
        }
    }

    public async importByRaw(payload: string): Promise<void> {
        const contact = this.state.contact

        if (!contact) {
            return
        }

        const rawPaste = payload.trim()

        this.state.toast = null

        try {
            await this.setImportData({ raw: rawPaste, source: "manual" })

            this.state.toast = this.i18n.t("chat.saveInboundOk")
        } catch (e) {
            const raw = e instanceof Error ? e.message : String(e)

            this.state.toast = isCiphertextForRecipientNotSelf(raw)
                ? this.i18n.t("chat.errCannotDecryptOwnOutgoing")
                : raw
        }
    }

    public async importByQrClipboard(): Promise<void> {
        this.state.toast = null

        try {
            const reader = new BrowserQRCodeReader()
            const payload = await decodeQrFromClipboardImage(reader)

            if (!payload) {
                this.state.toast = this.i18n.t("contacts.pasteQrNoCode")
                return
            }

            await this.setImportData({ raw: payload, source: "clipboard" })
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)

            this.state.toast = this.i18n.t("contacts.pasteQrFailed", { reason })
        }
    }

    public async importByQrFile(file: File): Promise<void> {
        this.state.toast = null

        try {
            const reader = new BrowserQRCodeReader()
            const payload = await decodeQrFromImageBlob(reader, file)

            if (!payload) {
                this.state.toast = this.i18n.t("contacts.pasteQrNoCode")
                return
            }

            await this.setImportData({ raw: payload, source: "file" })
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)

            this.state.toast = this.i18n.t("contacts.pasteQrFailed", { reason })
        }
    }

    private async setMessages(all: MessagePlain[]): Promise<void> {
        this.state.fullMessages = all
        this.state.listItems = all.slice(-VIEW_COUNT)

        await this.decryptMessages()
    }

    private async decryptImport(): Promise<void> {
        const gen = ++this.importDecryptGen
        const imp = this.state.import
        const data = imp.data
        const contact = this.state.contact

        invariant(data !== null, "Invalid import data")
        invariant(contact !== null, "Invalid contact")

        imp.decryptLoading = true
        imp.decryptPreview = null
        imp.decryptErr = null

        try {
            const r = await this.messaging.decryptIncoming(
                contact,
                data.raw,
                contact.cryptoProtocol,
            )

            if (gen !== this.importDecryptGen) {
                return
            }

            imp.decryptPreview = r
            imp.decryptErr = null
        } catch (e) {
            if (gen !== this.importDecryptGen) {
                return
            }

            imp.decryptPreview = null

            const raw = e instanceof Error ? e.message : String(e)

            imp.decryptErr = isCiphertextForRecipientNotSelf(raw)
                ? this.i18n.t("chat.errCannotDecryptOwnOutgoing")
                : raw
        } finally {
            if (gen === this.importDecryptGen) {
                imp.decryptLoading = false
            }
        }
    }

    private async decryptMessages(): Promise<void> {
        const contact = this.state.contact
        const messages = this.state.fullMessages

        if (!contact) {
            this.state.inboundPreview = {}

            return
        }

        const inbound = messages.filter((m) => m.direction === "in")

        if (inbound.length === 0) {
            this.state.inboundPreview = {}
        } else {
            const inboundEntries = await Promise.all(
                inbound.map(async (m) => {
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

            this.state.inboundPreview = Object.fromEntries(inboundEntries)
        }

        const outbound = messages.filter(
            (m) => m.direction === "out" && m.outboundSelfPayload,
        )

        if (outbound.length === 0) {
            this.state.outboundPreview = {}

            return
        }

        const outboundEntries = await Promise.all(
            outbound.map(async (m) => {
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

        this.state.outboundPreview = Object.fromEntries(outboundEntries)
    }
}
