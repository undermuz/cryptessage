import { HTTP_REST_V1_TRANSPORT_KIND } from "@/di/chat-transport/constants"
import { useT } from "@/di/react/hooks/useT"
import type { TransportSendPanelProps } from "@/views/widgets/chat-transport/transport-send-registry"

export function HttpRestSendPanelHeroUI(props: TransportSendPanelProps) {
    const t = useT()
    const { networkDelivery, contactName } = props

    const ok =
        networkDelivery !== null &&
        networkDelivery.kind === HTTP_REST_V1_TRANSPORT_KIND

    if (!ok) {
        return (
            <p className="text-sm text-default-500">
                {t("transport.httpRestAwait")}
            </p>
        )
    }

    return (
        <div className="space-y-3 rounded-2xl border border-divider bg-default-50/60 p-4">
            <p className="text-sm font-medium text-foreground">
                {t("transport.httpRestDeliveredTitle")}
            </p>
            <p className="text-xs text-default-600">
                {t("transport.httpRestDeliveredBody", {
                    name: contactName,
                    status: String(networkDelivery.status),
                })}
            </p>
            <p className="text-xs text-default-500">
                {t("transport.httpRestNoQrHint")}
            </p>
        </div>
    )
}
