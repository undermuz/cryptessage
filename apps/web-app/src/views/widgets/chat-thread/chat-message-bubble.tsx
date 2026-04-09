import { useT } from "@/di/react/hooks/useT"
import { useSnapshot } from "valtio/react"
import type { IChatThreadService } from "@/di/chat-thread/types"
import type { DecryptedMessageItem } from "@/di/chat-thread/types"

function renderBody(
    t: (key: string, options?: Record<string, unknown>) => string,
    item: DecryptedMessageItem,
) {
    const m = item.message
    const prev = item.decrypted
    const selfPayload = m.outboundSelfPayload

    if (m.direction === "out") {
        if (!selfPayload) {
            return (
                <p className="mt-1 text-xs text-muted-foreground">
                    {t("chat.outboundLegacyNoSelfCopy")}
                </p>
            )
        }

        if (!prev) {
            return (
                <p className="mt-1 text-xs text-muted-foreground">
                    {t("common.loading")}
                </p>
            )
        }

        if (prev.ok) {
            return (
                <div className="mt-1 space-y-0.5">
                    <p className="whitespace-pre-wrap text-sm leading-snug">
                        {prev.text}
                    </p>

                    {!prev.sig && (
                        <p className="text-[10px] text-muted-foreground">
                            {t("chat.signatureBad")}
                        </p>
                    )}
                </div>
            )
        }

        return <p className="mt-1 text-xs text-destructive">{prev.err}</p>
    }

    if (!prev) {
        return (
            <p className="mt-1 text-xs text-muted-foreground">
                {t("common.loading")}
            </p>
        )
    }

    if (prev.ok) {
        return (
            <div className="mt-1 space-y-0.5">
                <p className="whitespace-pre-wrap text-sm leading-snug">
                    {prev.text}
                </p>

                {!prev.sig && (
                    <p className="text-[10px] text-muted-foreground">
                        {t("chat.signatureBad")}
                    </p>
                )}
            </div>
        )
    }

    return <p className="mt-1 text-xs text-destructive">{prev.err}</p>
}

export function ChatMessageBubble({
    item,
    chat,
    onClick,
}: {
    item: DecryptedMessageItem
    chat: IChatThreadService
    onClick?: () => void
}) {
    const t = useT()

    useSnapshot(chat.state)

    const mine = item.message.direction === "out"

    return (
        <div
            className={`max-w-[min(85%,28rem)] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                mine
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border bg-background text-foreground"
            } ${mine ? "cursor-pointer select-none" : ""}`}
            role={mine ? "button" : undefined}
            tabIndex={mine ? 0 : undefined}
            onClick={mine ? onClick : undefined}
        >
            {renderBody(t, item)}
            <time
                className={`mt-1 block text-end text-[9px] font-medium uppercase tracking-tight ${
                    mine
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                }`}
                dateTime={new Date(item.message.createdAt).toISOString()}
            >
                {new Date(item.message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                })}
            </time>
        </div>
    )
}
