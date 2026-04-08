import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { useNextTickLayout } from "use-next-tick"

import { useT } from "@/di/react/hooks/useT"
import { useChatThread } from "@/di/react/hooks/useChatThread"
import type { MessagePlain } from "@/di/crypt-db/types-data"
import type { BidirectionalListRef } from "broad-infinite-list/react"

import { ChatReceiveEncryptedDialog } from "./chat-receive-encrypted-dialog"
import { ChatSendEncryptedDialog } from "./chat-send-encrypted-dialog"
import { ChatThreadComposer } from "./chat-thread-composer"
import { ChatThreadHeader } from "./chat-thread-header"
import { ChatThreadMessageList } from "./chat-thread-message-list"

export function ChatThreadWidget() {
    const t = useT()
    const { chat, snap } = useChatThread()
    const nextTick = useNextTickLayout()
    const { contactId } = useParams({ from: "/authed/chat/$contactId" })
    const listRef = useRef<BidirectionalListRef<MessagePlain>>(null)

    const [sendModalOpen, setSendModalOpen] = useState(false)
    const [receiveModalOpen, setReceiveModalOpen] = useState(false)

    const openSendModal = useCallback(() => {
        if (!chat.state.composerPlain.trim()) {
            return
        }

        chat.clearToast()
        setSendModalOpen(true)
    }, [chat])

    useEffect(() => {
        void chat.setActiveContactId(contactId ?? null)
    }, [contactId, chat])

    useEffect(() => {
        if (!snap.pendingScrollToBottom) {
            return
        }

        chat.clearPendingScrollToBottom()
        nextTick(() => {
            listRef.current?.scrollToBottom("instant")
        })
    }, [snap.pendingScrollToBottom, chat, nextTick])

    useEffect(() => {
        if (!sendModalOpen) {
            return
        }

        let cancelled = false

        void (async () => {
            try {
                await chat.encryptOnSendDialogOpened()
            } catch {
                if (!cancelled) {
                    setSendModalOpen(false)
                }
            }
        })()

        return () => {
            cancelled = true
        }
    }, [sendModalOpen, chat])

    if (!contactId) {
        return null
    }

    if (!snap.screenReady) {
        return (
            <p className="text-sm text-muted-foreground">
                {t("common.loading")}
            </p>
        )
    }

    if (!snap.contact) {
        return (
            <div className="space-y-2">
                <p className="text-muted-foreground">
                    {t("unlock.error.generic")}
                </p>
                <Link to="/" className="text-sm text-primary underline">
                    {t("chat.back")}
                </Link>
            </div>
        )
    }

    return (
        <div className="relative flex h-[calc(100dvh-9.5rem)] max-h-[800px] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lg">
            <ChatThreadHeader
                chat={chat}
                onReceiveClick={() => {
                    chat.clearToast()
                    setReceiveModalOpen(true)
                }}
            />

            <ChatThreadMessageList
                ref={listRef}
                chat={chat}
            />

            {snap.toast && (
                <p className="shrink-0 border-b border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
                    {snap.toast}
                </p>
            )}

            <ChatThreadComposer
                chat={chat}
                onSubmit={openSendModal}
            />

            <ChatSendEncryptedDialog
                open={sendModalOpen}
                onOpenChange={setSendModalOpen}
                chat={chat}
            />

            <ChatReceiveEncryptedDialog
                open={receiveModalOpen}
                onOpenChange={setReceiveModalOpen}
                chat={chat}
                onSaved={() => setReceiveModalOpen(false)}
            />
        </div>
    )
}
