import { Link } from "@tanstack/react-router"
import { Inbox } from "lucide-react"
import { Button } from "@heroui/react"
import { useSnapshot } from "valtio/react"

import type { IChatThreadService } from "@/di/chat-thread/types"
import { useT } from "@/di/react/hooks/useT"

import { initialsFromName } from "../utils"

export function ChatThreadHeaderHeroUI({
    chat,
    onReceiveClick,
}: {
    chat: IChatThreadService
    onReceiveClick: () => void
}) {
    const t = useT()
    const snap = useSnapshot(chat.state)
    const contact = snap.contact

    if (!contact) {
        return null
    }

    return (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-divider bg-default-50/95 px-4 py-3.5 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-3">
                <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-xs font-bold text-primary-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    aria-hidden
                >
                    {initialsFromName(contact.displayName)}
                </div>
                <div className="min-w-0">
                    <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight">
                        {contact.displayName}
                    </h1>
                    <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-default-500">
                        {contact.cryptoProtocol}
                    </p>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
                <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    aria-label={t("chat.receiveMessages")}
                    onPress={onReceiveClick}
                >
                    <Inbox className="size-5" />
                </Button>
                <Link
                    to="/"
                    className="rounded-lg px-2.5 py-2 text-sm font-medium text-default-600 transition-colors hover:bg-default-100 hover:text-foreground"
                >
                    {t("chat.back")}
                </Link>
            </div>
        </div>
    )
}

