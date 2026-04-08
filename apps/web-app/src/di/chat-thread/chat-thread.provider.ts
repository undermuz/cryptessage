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
    type IMessagingCryptoService,
} from "@/di/messaging-crypto/types"
import type { MessagePlain } from "@/di/crypt-db/types-data"
import { QR_MESSAGE_MAX_BYTES } from "@/di/secure/constants"
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

function createInitialChatThreadState(): ChatThreadState {
    return {
        contactId: null,
        screenReady: false,
        contact: null,
        fullMessages: [],
        listItems: [],
        composerPlain: "",
        armoredOut: "",
        messageQrPayload: null,
        pasteIn: "",
        warnLen: false,
        toast: null,
        exportQrExpanded: false,
        import: {
            data: null,
            decryptLoading: false,
            decryptPreview: null,
            decryptErr: null,
        },
        listDisable: true,
        inboundPreview: {},
        outboundPreview: {},
        pendingScrollToBottom: false,
    }
}

@injectable()
export class ChatThreadProvider implements IChatThreadService {
    public readonly state = proxy(createInitialChatThreadState())

    @inject(ConversationService)
    private readonly conv!: IConversationService

    @inject(MessagingCryptoService)
    private readonly messaging!: IMessagingCryptoService

    @inject(I18nProvider)
    private readonly i18n!: I18nService

    private loadGen = 0
    private importDecryptGen = 0

    public async setActiveContactId(contactId: string | null): Promise<void> {
        const gen = ++this.loadGen

        Object.assign(this.state, createInitialChatThreadState())
        this.state.contactId = contactId

        if (!contactId) {
            this.state.screenReady = true
            this.state.listDisable = false
            return
        }

        this.state.listDisable = true
        this.state.screenReady = false

        try {
            const c = await this.conv.getContact(contactId)

            if (gen !== this.loadGen) {
                return
            }

            this.state.contact = c

            const all = await this.conv.listMessages(contactId)

            if (gen !== this.loadGen) {
                return
            }

            this.applyMessagesLoaded(all)
        } finally {
            if (gen === this.loadGen) {
                this.state.listDisable = false
                this.state.screenReady = true
                this.state.pendingScrollToBottom = true
            }
        }
    }

    public setComposerPlain(value: string): void {
        this.state.composerPlain = value
    }

    public setPasteIn(value: string): void {
        this.state.pasteIn = value
    }

    public setExportQrExpanded(value: boolean): void {
        this.state.exportQrExpanded = value
    }

    public setImportData(data: ChatThreadImportState["data"]): void {
        const imp = this.state.import

        imp.data = data

        if (!data || !this.state.contact) {
            imp.decryptLoading = false
            imp.decryptPreview = null
            imp.decryptErr = null
            return
        }

        void this.runImportDecryptPreview()
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

    public readonly loadMore: IChatThreadService["loadMore"] = async (
        direction,
        refItem,
    ) => {
        await new Promise((r) => setTimeout(r, direction === "down" ? 80 : 200))

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
        const id = this.state.contactId

        if (!id) {
            return
        }

        const gen = this.loadGen

        this.state.listDisable = true

        const c = await this.conv.getContact(id)

        if (gen !== this.loadGen) {
            return
        }

        this.state.contact = c

        const all = await this.conv.listMessages(id)

        if (gen !== this.loadGen) {
            return
        }

        this.applyMessagesLoaded(all)
        this.state.listDisable = false
        this.state.pendingScrollToBottom = true
    }

    public async encryptOnSendDialogOpened(): Promise<void> {
        const contactId = this.state.contactId
        const contact = this.state.contact
        const plain = this.state.composerPlain

        invariant(contactId !== null, "Invalid contact ID")
        invariant(contact !== null, "Invalid contact")
        invariant(plain.trim().length > 0, "Invalid plain text")

        this.state.armoredOut = ""
        this.state.messageQrPayload = null
        this.state.warnLen = false
        this.state.toast = null

        try {
            const bundle = await this.conv.encryptOutgoingBundle(
                contactId,
                plain,
            )

            this.state.armoredOut = bundle.channelStorage
            this.state.messageQrPayload = bundle.qrPayloadBinary

            await this.conv.saveOutboundBundle(contactId, bundle)
            await this.reload()

            this.state.composerPlain = ""

            if (bundle.qrPayloadBinary.byteLength > QR_MESSAGE_MAX_BYTES) {
                this.state.warnLen = true
            }

            this.state.exportQrExpanded = true
        } catch (e) {
            const raw = e instanceof Error ? e.message : String(e)

            this.state.toast = raw

            throw e
        }
    }

    public async decryptArmoredPaste(): Promise<void> {
        const contact = this.state.contact

        if (!contact) {
            return
        }

        const rawPaste = this.state.pasteIn.trim()

        this.state.toast = null

        try {
            await this.messaging.decryptIncoming(
                contact,
                rawPaste,
                contact.cryptoProtocol,
            )
            await this.conv.saveInboundPayload(
                contact.id,
                rawPaste,
                contact.cryptoProtocol,
            )
            await this.reload()
            this.state.pasteIn = ""
            this.state.toast = this.i18n.t("chat.saveInboundOk")
        } catch (e) {
            const raw = e instanceof Error ? e.message : String(e)

            this.state.toast = isCiphertextForRecipientNotSelf(raw)
                ? this.i18n.t("chat.errCannotDecryptOwnOutgoing")
                : raw
        }
    }

    public async confirmSaveScannedInbound(): Promise<boolean> {
        const imp = this.state.import
        const data = imp.data
        const contact = this.state.contact

        if (!data || !contact) {
            return false
        }

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

    public async pasteMessageQrFromClipboard(): Promise<void> {
        this.state.toast = null

        try {
            const reader = new BrowserQRCodeReader()
            const payload = await decodeQrFromClipboardImage(reader)

            if (!payload) {
                this.state.toast = this.i18n.t("contacts.pasteQrNoCode")
                return
            }

            this.setImportData({ raw: payload, source: "clipboard" })
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)

            this.state.toast = this.i18n.t("contacts.pasteQrFailed", { reason })
        }
    }

    public async pickMessageQrFromFile(file: File): Promise<void> {
        this.state.toast = null

        try {
            const reader = new BrowserQRCodeReader()
            const payload = await decodeQrFromImageBlob(reader, file)

            if (!payload) {
                this.state.toast = this.i18n.t("contacts.pasteQrNoCode")
                return
            }

            this.setImportData({ raw: payload, source: "file" })
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)

            this.state.toast = this.i18n.t("contacts.pasteQrFailed", { reason })
        }
    }

    private applyMessagesLoaded(all: MessagePlain[]): void {
        this.state.fullMessages = all
        this.state.listItems = all.slice(-VIEW_COUNT)
        void this.refreshInboundOutboundPreviews()
    }

    private async runImportDecryptPreview(): Promise<void> {
        const gen = ++this.importDecryptGen
        const imp = this.state.import
        const data = imp.data
        const contact = this.state.contact

        if (!data || !contact) {
            return
        }

        imp.decryptLoading = true
        imp.decryptPreview = null
        imp.decryptErr = null

        try {
            const r = await this.messaging.decryptIncoming(
                contact,
                typeof data.raw === "string" ? data.raw : data.raw,
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

    private async refreshInboundOutboundPreviews(): Promise<void> {
        const contact = this.state.contact
        const full = this.state.fullMessages

        if (!contact) {
            this.state.inboundPreview = {}
            return
        }

        const inbound = full.filter((m) => m.direction === "in")

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

        const outbound = full.filter((m) => m.direction === "out")
        const withSelf = outbound.filter((m) => m.outboundSelfPayload)

        if (withSelf.length === 0) {
            this.state.outboundPreview = {}
            return
        }

        const outboundEntries = await Promise.all(
            withSelf.map(async (m) => {
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
