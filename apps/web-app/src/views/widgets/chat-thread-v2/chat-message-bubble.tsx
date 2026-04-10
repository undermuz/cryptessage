import { Check, TriangleAlert } from "lucide-react"
import { Spinner } from "@heroui/react"
import { useT } from "@/di/react/hooks/useT"
import { useSnapshot } from "valtio/react"
import type { DecryptedMessageItem, IChatThreadService } from "@/di/chat-thread/types"

function renderBody(
    t: (key: string, options?: Record<string, unknown>) => string,
    item: DecryptedMessageItem,
) {
    const m = item.message
    const prev = item.decrypted

    if (m.direction === "out") {
        if (!prev) {
            return (
                <p className="mt-1 text-xs text-default-500">
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
                        <p className="text-[10px] text-default-500">
                            {t("chat.signatureBad")}
                        </p>
                    )}
                </div>
            )
        }

        return <p className="mt-1 text-xs text-danger">{prev.err}</p>
    }

    if (!prev) {
        return (
            <p className="mt-1 text-xs text-default-500">
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
                    <p className="text-[10px] text-default-500">
                        {t("chat.signatureBad")}
                    </p>
                )}
            </div>
        )
    }

    return <p className="mt-1 text-xs text-danger">{prev.err}</p>
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
    const transportState = item.message.transportState

    return (
        <div
            className={`max-w-[min(88%,30rem)] rounded-[1.15rem] px-3.5 py-2.5 text-sm shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] ${
                mine
                    ? "rounded-br-lg bg-accent text-accent-foreground shadow-black/5"
                    : "rounded-bl-lg border border-divider bg-default-50/95 text-foreground"
            } ${mine ? "cursor-pointer select-none transition active:scale-[0.99]" : ""}`}
            role={mine ? "button" : undefined}
            tabIndex={mine ? 0 : undefined}
            onClick={mine ? onClick : undefined}
        >
            {renderBody(t, item)}
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
                {mine && transportState === "sending" && (
                    <Spinner
                        size="sm"
                        className={mine ? "text-accent-foreground/70" : ""}
                    />
                )}
                {mine && transportState === "sent" && (
                    <Check
                        className={`size-3 ${
                            mine
                                ? "text-accent-foreground/70"
                                : "text-default-500"
                        }`}
                        aria-label="Sent"
                    />
                )}
                {mine && transportState === "failed" && (
                    <TriangleAlert
                        className={`size-3 ${
                            mine
                                ? "text-accent-foreground/70"
                                : "text-danger"
                        }`}
                        aria-label="Failed"
                    />
                )}
                <time
                    className={`block text-end text-[9px] font-medium uppercase tracking-tight ${
                        mine
                            ? "text-accent-foreground/65"
                            : "text-default-500"
                    }`}
                    dateTime={new Date(item.message.createdAt).toISOString()}
                >
                    {new Date(item.message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </time>
            </div>
        </div>
    )
}

