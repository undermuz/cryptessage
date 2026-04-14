import type { ReactNode } from "react"

import type { IChatThreadService } from "@/di/chat-thread/types"
import { ImportQrBlock } from "@/views/widgets/qr-io-v2/import-qr-block"

export function ChatImportQrBlock({
    chat,
    pasteArmored,
    onPasteArmoredChange,
    t,
    isProcessing,
    onSend,
    onPasteFromClipboard,
    onPickFromFile,
    children,
}: {
    chat: IChatThreadService
    pasteArmored: string
    onPasteArmoredChange: (value: string) => void
    t: (key: string, options?: Record<string, unknown>) => string
    isProcessing: boolean
    onSend: () => void
    onPasteFromClipboard: () => void
    onPickFromFile: (file: File) => void
    children?: ReactNode
}) {
    return (
        <ImportQrBlock
            i18n={{
                scan: t("chat.scanMessageQr"),
                pasteFromImage: t("contacts.pasteQr"),
                pasteFromImagePending: t("contacts.pasteQrBusy"),
                pickQrImage: t("contacts.pickQrImage"),
                armoredSectionTitle: t("chat.pasteIn"),
                armoredSubmit: t("chat.decryptBtn"),
                armoredPlaceholder: t("chat.pasteArmoredPlaceholder"),
            }}
            armored={{
                value: pasteArmored,
                onChange: onPasteArmoredChange,
                onSubmit: onSend,
            }}
            isProcessing={isProcessing}
            childrenPlacement="bottom"
            armoredDisclosure={{
                triggerLabel: t("chat.pasteIn"),
                defaultExpanded: false,
            }}
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

