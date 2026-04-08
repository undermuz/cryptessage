import { QR_MESSAGE_MAX_BYTES } from "@/di/secure/constants"
import { useMemo, type ReactNode } from "react"
import { useT } from "@/di/react/hooks/useT"
import { Button } from "@/views/ui/button"
import { useSnapshot } from "valtio/react"
import type { Snapshot } from "valtio/vanilla"
import { useMutation } from "@tanstack/react-query"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/views/ui/dialog"
import { ImportQrBlock } from "@/views/widgets/qr-io/import-qr-block"
import { ImportQrPreviewShell } from "@/views/widgets/qr-io/import-qr-preview-shell"

import type {
    ChatThreadImportState,
    ChatThreadState,
    IChatThreadService,
} from "@/di/chat-thread/types"

import { payloadByteLength } from "./utils"

type NotNull<T> = T extends null ? never : T

function ChatImportQrPreview(props: {
    chat: IChatThreadService
    data: NotNull<ChatThreadImportState["data"]>
    t: ReturnType<typeof useT>
    onSave: () => void
}) {
    const { chat, data, t, onSave } = props

    const snap = useSnapshot(chat.state)

    const source = useMemo(() => {
        if (data.source === "camera") {
            return t("contacts.reviewSourceCamera")
        }

        if (data.source === "file") {
            return t("contacts.reviewSourceFile")
        }

        return t("contacts.reviewSourceClipboard")
    }, [data.source, t])

    const metaLine = `${source} · ${t("contacts.reviewPayloadSize", {
        n: payloadByteLength(data.raw),
    })}`

    const imp = snap.import

    const canReset =
        !imp.decryptLoading && imp.decryptErr && !imp.decryptPreview

    return (
        <ImportQrPreviewShell
            title={t("chat.reviewScannedCiphertext")}
            metaLine={metaLine}
            qrPayload={data.raw}
            maxQrBytes={QR_MESSAGE_MAX_BYTES}
            tooLongHint={t("contacts.reviewQrTooLong")}
        >
            {imp.decryptLoading && (
                <p className="text-muted-foreground">{t("common.loading")}</p>
            )}

            {imp.decryptErr && (
                <p className="text-sm text-destructive">{imp.decryptErr}</p>
            )}

            {imp.decryptPreview && (
                <>
                    <p className="text-sm font-medium">{t("chat.decrypted")}</p>
                    <p className="rounded-md bg-muted p-2 text-sm">
                        {imp.decryptPreview.text}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {imp.decryptPreview.signaturesValid
                            ? t("chat.signatureOk")
                            : t("chat.signatureBad")}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button type="button" onClick={onSave}>
                            {t("chat.saveInbound")}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => chat.setImportData(null)}
                        >
                            {t("contacts.discardReview")}
                        </Button>
                    </div>
                </>
            )}

            {canReset && (
                <div className="pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => chat.setImportData(null)}
                    >
                        {t("contacts.discardReview")}
                    </Button>
                </div>
            )}
        </ImportQrPreviewShell>
    )
}

function ChatImportQrBlock({
    chat,
    snap,
    t,
    isProcessing,
    onDecryptArmoredSubmit,
    onPasteFromClipboard,
    onPickFromFile,
    children,
}: {
    chat: IChatThreadService
    snap: Snapshot<ChatThreadState>
    t: ReturnType<typeof useT>
    isProcessing: boolean
    onDecryptArmoredSubmit: () => void
    onPasteFromClipboard: () => void
    onPickFromFile: (file: File) => void
    children?: ReactNode
}) {
    return (
        <ImportQrBlock
            i18n={{
                heading: t("chat.receiveEncrypted"),
                scan: t("chat.scanMessageQr"),
                pasteFromImage: t("contacts.pasteQr"),
                pasteFromImagePending: t("contacts.pasteQrBusy"),
                pickQrImage: t("contacts.pickQrImage"),
                armoredSectionTitle: t("chat.pasteIn"),
                armoredSubmit: t("chat.decryptBtn"),
                armoredPlaceholder: t("chat.pasteArmoredPlaceholder"),
            }}
            armored={{
                value: snap.pasteIn,
                onChange: (v) => chat.setPasteIn(v),
                onSubmit: onDecryptArmoredSubmit,
            }}
            isProcessing={isProcessing}
            onPasteQrFromImage={onPasteFromClipboard}
            onPickQrImageFile={onPickFromFile}
            onScannedPayload={(payload) =>
                chat.setImportData({
                    raw: payload,
                    source: "camera",
                })
            }
        >
            {children}
        </ImportQrBlock>
    )
}

export function ChatReceiveEncryptedDialog({
    open,
    onOpenChange,
    chat,
    onSaved,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    chat: IChatThreadService
    onSaved: () => void
}) {
    const t = useT()
    const snap = useSnapshot(chat.state)
    const contact = snap.contact

    const decryptArmoredPasteMutation = useMutation({
        mutationFn: () => chat.decryptArmoredPaste(),
    })

    const pasteMessageQrFromClipboardMutation = useMutation({
        mutationFn: () => chat.pasteMessageQrFromClipboard(),
    })

    const pickMessageQrFromFileMutation = useMutation({
        mutationFn: (file: File) => chat.pickMessageQrFromFile(file),
    })

    const confirmSaveScannedInboundMutation = useMutation({
        mutationFn: () => chat.confirmSaveScannedInbound(),
        onSuccess: (ok) => {
            if (ok) {
                onSaved()
            }
        },
    })

    const isProcessing =
        decryptArmoredPasteMutation.isPending ||
        pasteMessageQrFromClipboardMutation.isPending ||
        pickMessageQrFromFileMutation.isPending ||
        confirmSaveScannedInboundMutation.isPending

    if (!contact) {
        return null
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton
                className="flex max-h-[min(92dvh,48rem)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
            >
                <DialogHeader className="border-b border-border px-4 py-3 pr-10">
                    <DialogTitle className="text-left">
                        {t("chat.receiveModalTitle")}
                    </DialogTitle>
                    <DialogDescription className="text-left">
                        {t("chat.receiveOnlyIncomingHint", {
                            name: contact.displayName,
                        })}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[min(75dvh,40rem)] min-h-0 overflow-y-auto p-4">
                    <ChatImportQrBlock
                        chat={chat}
                        snap={snap}
                        t={t}
                        isProcessing={isProcessing}
                        onDecryptArmoredSubmit={() =>
                            decryptArmoredPasteMutation.mutate()
                        }
                        onPasteFromClipboard={() =>
                            pasteMessageQrFromClipboardMutation.mutate()
                        }
                        onPickFromFile={(file) =>
                            pickMessageQrFromFileMutation.mutate(file)
                        }
                    >
                        {snap.import.data !== null && (
                            <ChatImportQrPreview
                                chat={chat}
                                data={snap.import.data}
                                t={t}
                                onSave={() =>
                                    confirmSaveScannedInboundMutation.mutate()
                                }
                            />
                        )}
                    </ChatImportQrBlock>
                </div>
            </DialogContent>
        </Dialog>
    )
}
