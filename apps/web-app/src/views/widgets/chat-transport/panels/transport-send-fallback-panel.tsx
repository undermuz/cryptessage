import { useT } from "@/di/react/hooks/useT"
import type { TransportSendPanelProps } from "@/views/widgets/chat-transport/transport-send-registry"

export function TransportSendFallbackPanel(
    props: TransportSendPanelProps & { transportKind: string },
) {
    const t = useT()
    const { transportKind } = props

    return (
        <div className="rounded-2xl border border-dashed border-divider bg-default-50/50 p-4 text-sm text-default-600">
            <p className="font-medium text-foreground">
                {t("transport.panelUnsupportedTitle", { kind: transportKind })}
            </p>
            <p className="mt-2 text-xs text-default-500">
                {t("transport.panelUnsupportedHint")}
            </p>
        </div>
    )
}
