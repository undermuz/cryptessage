import { Button } from "@heroui/react"

import { BUILTIN_QR_TEXT_INSTANCE_ID } from "@/di/chat-transport/constants"
import { useT } from "@/di/react/hooks/useT"

import type { TransportDefaultRow } from "./use-settings-transports"

export function TransportDefaultPicker(props: {
    rows: TransportDefaultRow[]
    defaultInstanceId: string | null
    onSelect: (instanceId: string) => void
}) {
    const { rows, defaultInstanceId, onSelect } = props
    const t = useT()

    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-default-600">
                {t("transport.defaultTransport")}
            </p>
            <div className="flex flex-wrap gap-2">
                {rows.map((row) => (
                    <Button
                        key={row.id}
                        size="sm"
                        variant={
                            defaultInstanceId === row.id ||
                            (!defaultInstanceId &&
                                row.id === BUILTIN_QR_TEXT_INSTANCE_ID)
                                ? "secondary"
                                : "tertiary"
                        }
                        onPress={() => onSelect(row.id)}
                    >
                        {row.label}
                    </Button>
                ))}
            </div>
        </div>
    )
}
