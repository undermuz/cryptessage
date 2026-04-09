import type { MessagePlain } from "@/di/crypt-db/types-data"
import { useT } from "@/di/react/hooks/useT"
import { useSnapshot } from "valtio/react"
import type { IChatThreadService } from "@/di/chat-thread/types"

function renderBody(
    t: (key: string, options?: Record<string, unknown>) => string,
    m: MessagePlain,
    inboundPreview: IChatThreadService["state"]["inboundPreview"],
    outboundPreview: IChatThreadService["state"]["outboundPreview"],
) {
    const selfPayload = m.outboundSelfPayload

    if (m.direction === "out") {
        if (!selfPayload) {
            return (
                <p className="mt-1 text-xs text-muted-foreground">
                    {t("chat.outboundLegacyNoSelfCopy")}
                </p>
            )
        }

        const prev = outboundPreview[m.id]

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
                    <p className="text-[10px] text-muted-foreground">
                        {prev.sig
                            ? t("chat.signatureOk")
                            : t("chat.signatureBad")}
                    </p>
                </div>
            )
        }

        return <p className="mt-1 text-xs text-destructive">{prev.err}</p>
    }

    const prev = inboundPreview[m.id]

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
                <p className="text-[10px] text-muted-foreground">
                    {prev.sig ? t("chat.signatureOk") : t("chat.signatureBad")}
                </p>
            </div>
        )
    }

    return <p className="mt-1 text-xs text-destructive">{prev.err}</p>
}

export function ChatMessageBubble({
    message: m,
    chat,
}: {
    message: MessagePlain
    chat: IChatThreadService
}) {
    const t = useT()
    const snap = useSnapshot(chat.state)
    const mine = m.direction === "out"

    return (
        <div
            className={`max-w-[min(85%,28rem)] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                mine
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md border border-border bg-background text-foreground"
            }`}
        >
            {renderBody(t, m, snap.inboundPreview, snap.outboundPreview)}
            <time
                className={`mt-1 block text-end text-[9px] font-medium uppercase tracking-tight ${
                    mine
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                }`}
                dateTime={new Date(m.createdAt).toISOString()}
            >
                {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                })}
            </time>
        </div>
    )
}
