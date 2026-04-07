import type { ContactPlain } from "@/di/crypt-db/types-data"
import { QR_MESSAGE_MAX_BYTES } from "@/di/secure/constants"
import { useT } from "@/di/react/hooks/useT"
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

export function ChatSendEncryptedDialog({
    open,
    onOpenChange,
    encryptBusy,
    armoredOut,
    messageQrPayload,
    contact,
    exportQrExpanded,
    onExpandedChange,
    warnLen,
    exportLabels,
    onNotify,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    encryptBusy: boolean
    armoredOut: string
    messageQrPayload: Uint8Array | null
    contact: ContactPlain
    exportQrExpanded: boolean
    onExpandedChange: (v: boolean) => void
    warnLen: boolean
    exportLabels: ExportQrLabels
    onNotify: (msg: string | null) => void
}) {
    const t = useT()

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
                    {encryptBusy && (
                        <p className="mb-3 text-sm text-muted-foreground">
                            {t("common.loading")}
                        </p>
                    )}
                    {armoredOut && messageQrPayload && (
                        <ExportQrBlock
                            heading={t("chat.exportEncryptedSection")}
                            labels={exportLabels}
                            expanded={exportQrExpanded}
                            onExpandedChange={onExpandedChange}
                            qrPayload={messageQrPayload}
                            maxByteLength={QR_MESSAGE_MAX_BYTES}
                            armoredText={armoredOut}
                            onNotify={onNotify}
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
                            oversizeWarning={warnLen}
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
