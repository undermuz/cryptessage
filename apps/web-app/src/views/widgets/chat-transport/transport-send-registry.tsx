import type { ComponentType } from "react"

import {
    HTTP_REST_V1_TRANSPORT_KIND,
    QR_TEXT_TRANSPORT_KIND,
} from "@/di/chat-transport/constants"
import type { LastNetworkDelivery } from "@/di/chat-transport/types"
import type { EncryptedOutgoingBundle } from "@/di/messaging-crypto/types"
import type { ExportQrLabels } from "@/views/widgets/qr-io-v2/export-qr-block"

import { HttpRestSendPanelHeroUI } from "./panels/http-rest-send-panel.heroui"
import { QrTextSendPanelHeroUI } from "./panels/qr-text-send-panel.heroui"

export type TransportSendPanelProps = {
    bundle: EncryptedOutgoingBundle
    contactName: string
    labels: ExportQrLabels
    onNotify: (message: string | null) => void
    networkDelivery: LastNetworkDelivery | null
    /** Optional: e.g. HTTP REST panel uses this to re-POST the pending ciphertext. */
    onRetryNetworkSend?: () => Promise<void>
}

export const transportSendPanelRegistry: Record<
    string,
    ComponentType<TransportSendPanelProps>
> = {
    [QR_TEXT_TRANSPORT_KIND]: QrTextSendPanelHeroUI,
    [HTTP_REST_V1_TRANSPORT_KIND]: HttpRestSendPanelHeroUI,
}
