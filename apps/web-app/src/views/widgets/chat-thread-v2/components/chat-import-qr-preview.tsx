import { useMemo } from "react"
import { Button } from "@heroui/react"
import { useSnapshot } from "valtio/react"

import type { ChatThreadImportState, IChatThreadService } from "@/di/chat-thread/types"
import { QR_MESSAGE_MAX_BYTES } from "@/di/secure/constants"
import { ImportQrPreviewShell } from "@/views/widgets/qr-io-v2/import-qr-preview-shell"

import type { NotNull } from "../types"
import { payloadByteLength } from "../utils"

export function ChatImportQrPreviewHeroUI(props: {
    chat: IChatThreadService
    data: NotNull<ChatThreadImportState["data"]>
    t: (key: string, options?: Record<string, unknown>) => string
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

    const canReset = !imp.pending && imp.error && !imp.decrypted

    return (
        <ImportQrPreviewShell
            title={t("chat.reviewScannedCiphertext")}
            metaLine={metaLine}
            qrPayload={data.raw}
            maxQrBytes={QR_MESSAGE_MAX_BYTES}
            tooLongHint={t("contacts.reviewQrTooLong")}
        >
            {imp.pending && (
                <p className="text-default-500">{t("common.loading")}</p>
            )}

            {imp.error && <p className="text-sm text-danger">{imp.error}</p>}

            {imp.decrypted && (
                <>
                    <p className="text-sm font-medium">{t("chat.decrypted")}</p>
                    <p className="rounded-md bg-default-100 p-2 text-sm">
                        {imp.decrypted.text}
                    </p>
                    <p className="text-xs text-default-500">
                        {imp.decrypted.signaturesValid
                            ? t("chat.signatureOk")
                            : t("chat.signatureBad")}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button variant="primary" onPress={onSave}>
                            {t("chat.saveInbound")}
                        </Button>
                        <Button
                            variant="outline"
                            onPress={() => chat.setImportData(null)}
                        >
                            {t("contacts.discardReview")}
                        </Button>
                    </div>
                </>
            )}

            {canReset && (
                <div className="pt-2">
                    <Button
                        variant="outline"
                        onPress={() => chat.setImportData(null)}
                    >
                        {t("contacts.discardReview")}
                    </Button>
                </div>
            )}
        </ImportQrPreviewShell>
    )
}

