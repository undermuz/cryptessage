import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react"
import { Link, useParams } from "@tanstack/react-router"
import { BrowserQRCodeReader } from "@zxing/browser"
import type { BidirectionalListProps, BidirectionalListRef } from "broad-infinite-list/react"
import { useNextTickLayout } from "use-next-tick"

import { useT } from "@/di/react/hooks/useT"
import { useDi } from "@/di/react/hooks/useDi"
import {
    ConversationService,
    type IConversationService,
} from "@/di/conversation/types"
import {
    MessagingCryptoService,
    type IMessagingCryptoService,
} from "@/di/messaging-crypto/types"
import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"
import type { ContactPlain, MessagePlain } from "@/di/crypt-db/types-data"
import { QR_MESSAGE_MAX_BYTES } from "@/di/secure/constants"
import type { ExportQrLabels } from "@/views/widgets/qr-io/export-qr-block"
import {
    decodeQrFromClipboardImage,
    decodeQrFromImageBlob,
} from "@/views/widgets/qr-scanner/clipboard-qr"

import { ChatReceiveEncryptedDialog } from "./chat-receive-encrypted-dialog"
import { ChatSendEncryptedDialog } from "./chat-send-encrypted-dialog"
import { ChatThreadComposer } from "./chat-thread-composer"
import { ChatThreadHeader } from "./chat-thread-header"
import { ChatThreadMessageList } from "./chat-thread-message-list"
import { PAGE_SIZE, VIEW_COUNT } from "./constants"
import type { ImportSource } from "./types"
import { isCiphertextForRecipientNotSelf } from "./utils"

export function ChatThreadWidget() {
    const t = useT()
    const nextTick = useNextTickLayout()
    const { contactId } = useParams({ from: "/authed/chat/$contactId" })
    const conv = useDi<IConversationService>(ConversationService)
    const messaging = useDi<IMessagingCryptoService>(MessagingCryptoService)

    const [contact, setContact] = useState<ContactPlain | null>(null)
    const [fullMessages, setFullMessages] = useState<MessagePlain[]>([])
    const [listItems, setListItems] = useState<MessagePlain[]>([])
    const [plain, setPlain] = useState("")
    const [armoredOut, setArmoredOut] = useState("")
    const [messageQrPayload, setMessageQrPayload] = useState<Uint8Array | null>(
        null,
    )
    const [pasteIn, setPasteIn] = useState("")
    const [warnLen, setWarnLen] = useState(false)
    const [toast, setToast] = useState<string | null>(null)

    const [exportQrExpanded, setExportQrExpanded] = useState(false)
    const [importScan, setImportScan] = useState(false)
    const [importPending, setImportPending] = useState<{
        raw: VisitCardRawPayload
        source: ImportSource
    } | null>(null)
    const [importDecryptLoading, setImportDecryptLoading] = useState(false)
    const [importDecryptPreview, setImportDecryptPreview] = useState<{
        text: string
        signaturesValid: boolean
    } | null>(null)
    const [importDecryptErr, setImportDecryptErr] = useState<string | null>(
        null,
    )
    const [pasteQrBusy, setPasteQrBusy] = useState(false)

    const [sendModalOpen, setSendModalOpen] = useState(false)
    const [receiveModalOpen, setReceiveModalOpen] = useState(false)
    const [encryptBusy, setEncryptBusy] = useState(false)
    const [listDisable, setListDisable] = useState(true)

    const [inboundPreview, setInboundPreview] = useState<
        Record<
            string,
            | { ok: true; text: string; sig: boolean }
            | { ok: false; err: string }
        >
    >({})

    const [outboundPreview, setOutboundPreview] = useState<
        Record<
            string,
            | { ok: true; text: string; sig: boolean }
            | { ok: false; err: string }
        >
    >({})

    const listRef = useRef<BidirectionalListRef<MessagePlain>>(null)

    const reload = async () => {
        if (!contactId) {
            return
        }

        setListDisable(true)
        const c = await conv.getContact(contactId)
        setContact(c)
        const all = await conv.listMessages(contactId)
        setFullMessages(all)
        setListItems(all.slice(-VIEW_COUNT))
        nextTick(() => {
            listRef.current?.scrollToBottom("instant")
            setListDisable(false)
        })
    }

    useEffect(() => {
        void reload()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when route id changes
    }, [contactId])

    useEffect(() => {
        if (armoredOut) {
            setExportQrExpanded(true)
        }
    }, [armoredOut])

    useEffect(() => {
        if (!importPending || !contact) {
            setImportDecryptLoading(false)
            setImportDecryptPreview(null)
            setImportDecryptErr(null)
            return
        }

        let cancelled = false
        setImportDecryptLoading(true)
        setImportDecryptPreview(null)
        setImportDecryptErr(null)
        void messaging
            .decryptIncoming(
                contact,
                typeof importPending.raw === "string"
                    ? importPending.raw
                    : importPending.raw,
                contact.cryptoProtocol,
            )
            .then((r) => {
                if (!cancelled) {
                    setImportDecryptPreview(r)
                    setImportDecryptErr(null)
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setImportDecryptPreview(null)
                    const raw = e instanceof Error ? e.message : String(e)
                    setImportDecryptErr(
                        isCiphertextForRecipientNotSelf(raw)
                            ? t("chat.errCannotDecryptOwnOutgoing")
                            : raw,
                    )
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setImportDecryptLoading(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [importPending, contact, messaging, t])

    useEffect(() => {
        if (!contact) {
            setInboundPreview({})
            return
        }

        const inbound = fullMessages.filter((m) => m.direction === "in")

        if (inbound.length === 0) {
            setInboundPreview({})
            return
        }

        let cancelled = false
        void Promise.all(
            inbound.map(async (m) => {
                try {
                    const r = await messaging.decryptIncoming(
                        contact,
                        m.channelPayload,
                        m.cryptoProtocol,
                    )
                    return [
                        m.id,
                        { ok: true, text: r.text, sig: r.signaturesValid },
                    ] as const
                } catch (e) {
                    const err = e instanceof Error ? e.message : String(e)
                    return [m.id, { ok: false, err }] as const
                }
            }),
        ).then((entries) => {
            if (!cancelled) {
                setInboundPreview(Object.fromEntries(entries))
            }
        })

        return () => {
            cancelled = true
        }
    }, [fullMessages, contact, messaging])

    useEffect(() => {
        const outbound = fullMessages.filter((m) => m.direction === "out")
        const withSelf = outbound.filter((m) => m.outboundSelfPayload)

        if (withSelf.length === 0) {
            setOutboundPreview({})
            return
        }

        let cancelled = false
        void Promise.all(
            withSelf.map(async (m) => {
                const selfPl = m.outboundSelfPayload

                if (!selfPl) {
                    return [m.id, { ok: false, err: "missing self payload" }] as const
                }

                try {
                    const r = await messaging.decryptOutboundSelf(
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
        ).then((entries) => {
            if (!cancelled) {
                setOutboundPreview(Object.fromEntries(entries))
            }
        })

        return () => {
            cancelled = true
        }
    }, [fullMessages, messaging])

    const onEncrypt = async () => {
        if (!contactId || !contact) {
            return
        }

        setArmoredOut("")
        setMessageQrPayload(null)
        setWarnLen(false)
        setToast(null)
        const bundle = await conv.encryptOutgoingBundle(contactId, plain)
        setArmoredOut(bundle.channelStorage)
        setMessageQrPayload(bundle.qrPayloadBinary)
        await conv.saveOutboundBundle(contactId, bundle)
        await reload()
        setPlain("")

        if (bundle.qrPayloadBinary.byteLength > QR_MESSAGE_MAX_BYTES) {
            setWarnLen(true)
        }
    }

    const onDecryptArmoredPaste = async () => {
        if (!contact) {
            return
        }

        setToast(null)

        try {
            await messaging.decryptIncoming(
                contact,
                pasteIn.trim(),
                contact.cryptoProtocol,
            )
            await conv.saveInboundPayload(
                contact.id,
                pasteIn.trim(),
                contact.cryptoProtocol,
            )
            await reload()
            setPasteIn("")
            setToast(t("chat.saveInboundOk"))
        } catch (e) {
            const raw = e instanceof Error ? e.message : String(e)
            setToast(
                isCiphertextForRecipientNotSelf(raw)
                    ? t("chat.errCannotDecryptOwnOutgoing")
                    : raw,
            )
        }
    }

    const confirmSaveScannedInbound = async () => {
        if (!importPending || !contact) {
            return
        }

        setToast(null)

        try {
            const normalized =
                await messaging.normalizeInboundPayload(importPending.raw)
            await conv.saveInboundPayload(
                contact.id,
                normalized.channelStorage,
                normalized.cryptoProtocol,
            )
            setImportPending(null)
            setImportDecryptPreview(null)
            setImportDecryptErr(null)
            await reload()
            setReceiveModalOpen(false)
            setToast(t("chat.saveInboundOk"))
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)
            setToast(t("chat.saveInboundFail", { reason }))
        }
    }

    const onPasteMessageQrFromClipboard = async () => {
        setPasteQrBusy(true)
        setToast(null)

        try {
            const reader = new BrowserQRCodeReader()
            const payload = await decodeQrFromClipboardImage(reader)

            if (!payload) {
                setToast(t("contacts.pasteQrNoCode"))
                return
            }

            setImportPending({ raw: payload, source: "clipboard" })
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)
            setToast(t("contacts.pasteQrFailed", { reason }))
        } finally {
            setPasteQrBusy(false)
        }
    }

    const onPickMessageQrFromFile = (file: File) => {
        setPasteQrBusy(true)
        setToast(null)

        void (async () => {
            try {
                const reader = new BrowserQRCodeReader()
                const payload = await decodeQrFromImageBlob(reader, file)

                if (!payload) {
                    setToast(t("contacts.pasteQrNoCode"))
                    return
                }

                setImportPending({ raw: payload, source: "file" })
            } catch (e) {
                const reason = e instanceof Error ? e.message : String(e)
                setToast(t("contacts.pasteQrFailed", { reason }))
            } finally {
                setPasteQrBusy(false)
            }
        })()
    }

    const handleLoadMore: BidirectionalListProps<MessagePlain>["onLoadMore"] =
        useCallback(
            async (direction, refItem) => {
                await new Promise((r) =>
                    setTimeout(r, direction === "down" ? 80 : 200),
                )
                const idx = fullMessages.findIndex((m) => m.id === refItem.id)

                if (idx === -1) {
                    return []
                }

                if (direction === "up") {
                    const start = Math.max(0, idx - PAGE_SIZE)
                    return fullMessages.slice(start, idx)
                }

                const end = Math.min(fullMessages.length, idx + PAGE_SIZE + 1)
                return fullMessages.slice(idx + 1, end)
            },
            [fullMessages],
        )

    const hasPrevious =
        listItems.length > 0 &&
        listItems[0]?.id !== fullMessages[0]?.id
    const hasNext =
        listItems.length > 0 &&
        listItems[listItems.length - 1]?.id !==
            fullMessages[fullMessages.length - 1]?.id

    const showJumpToBottom =
        listItems.length > 0 &&
        listItems[listItems.length - 1]?.id !==
            fullMessages[fullMessages.length - 1]?.id

    const onJumpToBottom = () => {
        setListItems(fullMessages.slice(-VIEW_COUNT))
        nextTick(() => {
            listRef.current?.scrollToBottom("instant")
        })
    }

    useEffect(() => {
        if (!sendModalOpen || !plain.trim()) {
            return
        }

        let cancelled = false

        void (async () => {
            setEncryptBusy(true)

            try {
                await onEncrypt()
            } catch (e) {
                const raw = e instanceof Error ? e.message : String(e)
                setToast(raw)

                if (!cancelled) {
                    setSendModalOpen(false)
                }
            } finally {
                setEncryptBusy(false)
            }
        })()

        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run encrypt once per modal open
    }, [sendModalOpen])

    const exportLabels: ExportQrLabels = {
        showQr: t("contacts.showQr"),
        hideQr: t("contacts.hideQr"),
        copyQrImage: t("contacts.copyQr"),
        shareQr: t("contacts.shareQr"),
        copyArmored: t("chat.copyArmored"),
        copyQrUnavailable: t("contacts.copyQrUnavailable"),
        copyQrFail: (reason) => t("contacts.copyQrFail", { reason }),
        copyQrOk: t("contacts.copyQrOk"),
        copyArmoredOk: t("chat.copyArmoredOk"),
        shareUnavailable: t("contacts.shareUnavailable"),
        shareFail: (reason) => t("contacts.shareFail", { reason }),
    }

    if (!contactId) {
        return null
    }

    if (contact === null) {
        return (
            <div className="space-y-2">
                <p className="text-muted-foreground">{t("unlock.error.generic")}</p>
                <Link to="/" className="text-sm text-primary underline">
                    {t("chat.back")}
                </Link>
            </div>
        )
    }

    const openSendModal = () => {
        if (!plain.trim()) {
            return
        }

        setToast(null)
        setSendModalOpen(true)
    }

    return (
        <div className="relative flex h-[calc(100dvh-9.5rem)] max-h-[800px] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lg">
            <ChatThreadHeader
                contact={contact}
                onReceiveClick={() => {
                    setToast(null)
                    setReceiveModalOpen(true)
                }}
            />

            <ChatThreadMessageList
                ref={listRef}
                listItems={listItems}
                listDisable={listDisable}
                hasPrevious={hasPrevious}
                hasNext={hasNext}
                onLoadMore={handleLoadMore}
                onItemsChange={setListItems}
                showJumpToBottom={showJumpToBottom}
                onJumpToBottom={onJumpToBottom}
                inboundPreview={inboundPreview}
                outboundPreview={outboundPreview}
            />

            {toast && (
                <p className="shrink-0 border-b border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
                    {toast}
                </p>
            )}

            <ChatThreadComposer
                value={plain}
                onChange={setPlain}
                onSubmit={openSendModal}
            />

            <ChatSendEncryptedDialog
                open={sendModalOpen}
                onOpenChange={setSendModalOpen}
                encryptBusy={encryptBusy}
                armoredOut={armoredOut}
                messageQrPayload={messageQrPayload}
                contact={contact}
                exportQrExpanded={exportQrExpanded}
                onExpandedChange={setExportQrExpanded}
                warnLen={warnLen}
                exportLabels={exportLabels}
                onNotify={setToast}
            />

            <ChatReceiveEncryptedDialog
                open={receiveModalOpen}
                onOpenChange={setReceiveModalOpen}
                contact={contact}
                pasteIn={pasteIn}
                onPasteInChange={setPasteIn}
                onDecryptArmoredPaste={() => void onDecryptArmoredPaste()}
                pasteQrBusy={pasteQrBusy}
                importScan={importScan}
                onImportScanOpen={() => setImportScan(true)}
                onImportScanClose={() => setImportScan(false)}
                onPasteMessageQrFromClipboard={() =>
                    void onPasteMessageQrFromClipboard()
                }
                onPickMessageQrFromFile={onPickMessageQrFromFile}
                importPending={importPending}
                onImportPending={setImportPending}
                importDecryptLoading={importDecryptLoading}
                importDecryptPreview={importDecryptPreview}
                importDecryptErr={importDecryptErr}
                onConfirmSaveScannedInbound={() =>
                    void confirmSaveScannedInbound()
                }
            />
        </div>
    )
}
