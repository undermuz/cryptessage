import { useEffect, useState } from "react"

import { QR_MESSAGE_MAX_BYTES } from "@/di/secure/constants"
import { useT } from "@/di/react/hooks/useT"
import { useSnapshot } from "valtio/react"
import {
    ExportQrBlock,
    type ExportQrLabels,
} from "@/views/widgets/qr-io/export-qr-block"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/views/ui/dialog"
import type { EncryptedOutgoingBundle } from "@/di/messaging-crypto/types"
import type { IChatThreadService } from "@/di/chat-thread/types"

export function ChatSendEncryptedDialog(props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    chat: IChatThreadService
    encryptedResult: EncryptedOutgoingBundle | null
    isPending: boolean
}) {
    const { open, onOpenChange, chat, encryptedResult, isPending } = props

    const t = useT()
    const snap = useSnapshot(chat.state)
    const contact = snap.contact

    const [exportQrExpanded, setExportQrExpanded] = useState(false)

    useEffect(() => {
        if (open) {
            setExportQrExpanded(false)
        }
    }, [open])

    useEffect(() => {
        if (!open || !encryptedResult) {
            return
        }

        setExportQrExpanded(true)
    }, [open, encryptedResult])

    const qrOversized =
        encryptedResult !== null &&
        encryptedResult.qrPayloadBinary.byteLength > QR_MESSAGE_MAX_BYTES

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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton
                className="flex max-h-[min(90dvh,44rem)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
            >
                <DialogHeader className="border-b border-border px-4 py-3 pr-10">
                    <DialogTitle className="text-left">
                        {t("chat.sendEncryptedTitle")}
                    </DialogTitle>
                </DialogHeader>

                <div className="max-h-[min(70dvh,36rem)] min-h-0 overflow-y-auto p-4">
                    {isPending && (
                        <p className="mb-3 text-sm text-muted-foreground">
                            {t("common.loading")}
                        </p>
                    )}

                    {contact && encryptedResult && (
                        <ExportQrBlock
                            heading={t("chat.exportEncryptedSection")}
                            labels={exportLabels}
                            expanded={exportQrExpanded}
                            onExpandedChange={setExportQrExpanded}
                            qrPayload={encryptedResult.qrPayloadBinary}
                            maxByteLength={QR_MESSAGE_MAX_BYTES}
                            armoredText={encryptedResult.channelStorage}
                            onNotify={(msg) => chat.setToast(msg)}
                            showArmoredPreview
                            footer={
                                <div className="space-y-2 text-xs text-muted-foreground">
                                    <p>
                                        {t("chat.exportForContactHint", {
                                            name: contact.displayName,
                                        })}
                                    </p>
                                    <p>
                                        {t("chat.qrBinaryHint", {
                                            max: QR_MESSAGE_MAX_BYTES,
                                        })}
                                    </p>
                                </div>
                            }
                            oversizeWarning={qrOversized}
                            oversizeMessage={
                                <p className="text-xs text-destructive">
                                    {t("chat.qrTooLarge", {
                                        max: QR_MESSAGE_MAX_BYTES,
                                    })}
                                </p>
                            }
                            shareFileName="cryptessage-message-qr.png"
                            shareTitle="cryptessage"
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
