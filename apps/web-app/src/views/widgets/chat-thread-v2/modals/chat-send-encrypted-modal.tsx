import { useMemo } from "react"
import { Modal } from "@heroui/react"
import { useSnapshot } from "valtio/react"

import type { IChatThreadService } from "@/di/chat-thread/types"
import { QR_MESSAGE_MAX_BYTES } from "@/di/secure/constants"
import { useT } from "@/di/react/hooks/useT"
import type { EncryptedOutgoingBundle } from "@/di/messaging-crypto/types"
import {
    ExportQrBlock,
    type ExportQrLabels,
} from "@/views/widgets/qr-io-v2/export-qr-block"

export function ChatSendEncryptedModalHeroUI(props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    chat: IChatThreadService
    encryptedResult: EncryptedOutgoingBundle | null
    onNotify: (message: string | null) => void
    isPending: boolean
}) {
    const { open, onOpenChange, chat, encryptedResult, onNotify, isPending } =
        props

    const t = useT()
    const snap = useSnapshot(chat.state)
    const contact = snap.contact

    const qrOversized =
        encryptedResult !== null &&
        encryptedResult.qrPayloadBinary.byteLength > QR_MESSAGE_MAX_BYTES

    const exportLabels: ExportQrLabels = useMemo(
        () => ({
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
        }),
        [t],
    )

    return (
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="lg" scroll="inside">
                    <Modal.Dialog className="max-h-[min(90dvh,44rem)] overflow-hidden p-0">
                        <Modal.Header className="border-b border-divider px-4 py-3">
                            {t("chat.sendEncryptedTitle")}
                        </Modal.Header>
                        <Modal.Body className="space-y-4 p-4">
                            {isPending && (
                                <p className="mb-3 text-sm text-default-500">
                                    {t("common.loading")}
                                </p>
                            )}

                            {contact && encryptedResult && (
                                <ExportQrBlock
                                    labels={exportLabels}
                                    expanded
                                    qrPayload={encryptedResult.qrPayloadBinary}
                                    maxByteLength={QR_MESSAGE_MAX_BYTES}
                                    armoredText={encryptedResult.channelStorage}
                                    onNotify={onNotify}
                                    showArmoredPreview
                                    footer={
                                        <div className="space-y-2 text-xs text-default-500">
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
                                        <p className="text-xs text-danger">
                                            {t("chat.qrTooLarge", {
                                                max: QR_MESSAGE_MAX_BYTES,
                                            })}
                                        </p>
                                    }
                                    shareFileName="cryptessage-message-qr.png"
                                    shareTitle="cryptessage"
                                />
                            )}
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}

