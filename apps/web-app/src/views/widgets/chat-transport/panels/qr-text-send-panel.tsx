import { useMemo } from "react"

import { QR_MESSAGE_MAX_BYTES } from "@/di/secure/constants"
import type { TransportSendPanelProps } from "@/views/widgets/chat-transport/transport-send-registry"
import { ExportQrBlock } from "@/views/widgets/qr-io-v2/export-qr-block"
import { useT } from "@/di/react/hooks/useT"

export function QrTextSendPanel(props: TransportSendPanelProps) {
    const { bundle, contactName, labels, onNotify } = props
    void props.networkDelivery
    const t = useT()
    const qrOversized =
        bundle.qrPayloadBinary.byteLength > QR_MESSAGE_MAX_BYTES

    const footer = useMemo(
        () => (
            <div className="space-y-2 text-xs text-default-500">
                <p>
                    {t("chat.exportForContactHint", {
                        name: contactName,
                    })}
                </p>
                <p>
                    {t("chat.qrBinaryHint", {
                        max: QR_MESSAGE_MAX_BYTES,
                    })}
                </p>
            </div>
        ),
        [contactName, t],
    )

    return (
        <ExportQrBlock
            labels={labels}
            expanded
            qrPayload={bundle.qrPayloadBinary}
            maxByteLength={QR_MESSAGE_MAX_BYTES}
            armoredText={bundle.channelStorage}
            onNotify={onNotify}
            showArmoredPreview
            footer={footer}
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
    )
}
