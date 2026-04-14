import { Button } from "@heroui/react"

import type { TransportProfilePlain } from "@/di/chat-transport/types"
import { useT } from "@/di/react/hooks/useT"

export function TransportProfileList(props: {
    builtinLabel: string
    builtinKind: string
    profiles: TransportProfilePlain[]
    onEdit: (p: TransportProfilePlain) => void
    onRemove: (instanceId: string) => void
}) {
    const { builtinLabel, builtinKind, profiles, onEdit, onRemove } = props
    const t = useT()

    return (
        <ul className="space-y-2">
            <li className="flex items-center justify-between gap-2 rounded-xl border border-divider px-3 py-2 text-xs">
                <span className="min-w-0 truncate font-medium">
                    {builtinLabel}
                </span>
                <span className="shrink-0 text-default-500">
                    {t("transport.builtIn")} · {builtinKind}
                </span>
            </li>
            {profiles.map((p) => (
                <li
                    key={p.instanceId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-divider px-3 py-2 text-xs"
                >
                    <div className="min-w-0">
                        <p className="truncate font-medium">{p.label}</p>
                        <p className="text-default-500">{p.kind}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1">
                        <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => onEdit(p)}
                        >
                            {t("transport.edit")}
                        </Button>
                        <Button
                            size="sm"
                            variant="danger-soft"
                            onPress={() => onRemove(p.instanceId)}
                        >
                            {t("transport.remove")}
                        </Button>
                    </div>
                </li>
            ))}
        </ul>
    )
}
