import { Link } from "@tanstack/react-router"
import { Inbox } from "lucide-react"
import { useSnapshot } from "valtio/react"

import type { IChatThreadService } from "@/di/chat-thread/types"
import { useT } from "@/di/react/hooks/useT"
import { Button, buttonVariants } from "@/views/ui/button"
import { cn } from "@/lib/utils"

import { initialsFromName } from "./utils"

export function ChatThreadHeader({
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
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/90 px-3 py-3 backdrop-blur-sm">
            <div className="flex min-w-0 items-center gap-3">
                <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-primary/70 text-xs font-bold text-primary-foreground shadow-md"
                    aria-hidden
                >
                    {initialsFromName(contact.displayName)}
                </div>
                <div className="min-w-0">
                    <h1 className="truncate text-sm font-semibold leading-tight">
                        {contact.displayName}
                    </h1>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {contact.cryptoProtocol}
                    </p>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("chat.receiveMessages")}
                    title={t("chat.receiveMessages")}
                    onClick={onReceiveClick}
                >
                    <Inbox className="size-5" />
                </Button>
                <Link
                    to="/"
                    className={cn(
                        buttonVariants({
                            variant: "ghost",
                            size: "sm",
                        }),
                        "text-muted-foreground",
                    )}
                >
                    {t("chat.back")}
                </Link>
            </div>
        </div>
    )
}
