import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { useNextTickLayout } from "use-next-tick"

import { useDi } from "@/di/react/hooks/useDi"
import {
    EventBusProvider,
    type IEventObserver,
} from "@/di/utils/event-bus/types"
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
    const nextTick = useNextTickLayout()

    const { chat, snap } = useChatThread()
    const events = useDi<IEventObserver>(EventBusProvider)

    const { contactId } = useParams({ from: "/authed/chat/$contactId" })

    const listRef = useRef<BidirectionalListRef<MessagePlain>>(null)

    const [threadScreenReady, setThreadScreenReady] = useState(false)

    const [sendModalOpen, setSendModalOpen] = useState(false)
    const [receiveModalOpen, setReceiveModalOpen] = useState(false)
    const [newMessageText, setNewMessageText] = useState("")
    const sendMessageTextRef = useRef("")
    const [toast, setToast] = useState<string | null>(null)

    const setActiveContactId = useMutation({
        mutationFn: (id: string | null) => chat.setActiveContactId(id),
    })

    const sendNewMessage = useMutation({
        mutationFn: (messageText: string) => chat.onSendNewMessage(messageText),
        onSuccess: () => {
            setNewMessageText("")
        },
        onError: () => {
            setSendModalOpen(false)
        },
    })

    const sendNewMessageMutate = sendNewMessage.mutate
    const setActiveContactIdMutate = setActiveContactId.mutate

    const openSendModal = useCallback(() => {
        const sendMessageText = newMessageText.trim()

        if (!sendMessageText) {
            return
        }

        setToast(null)

        sendMessageTextRef.current = sendMessageText

        setSendModalOpen(true)

        sendNewMessageMutate(sendMessageText)
    }, [newMessageText, sendNewMessageMutate])

    useEffect(() => {
        const cb = events.on("chatThread:toast", (message: string | null) => {
            setToast(message)
        })

        return () => {
            events.off("chatThread:toast", cb)
        }
    }, [events])

    useEffect(() => {
        if (!contactId) {
            return
        }

        setThreadScreenReady(false)

        setActiveContactIdMutate(contactId, {
            onSettled: () => {
                setThreadScreenReady(true)
            },
        })
    }, [contactId, setActiveContactIdMutate])

    useEffect(() => {
        setNewMessageText("")
    }, [contactId])

    useEffect(() => {
        if (!snap.pendingScrollToBottom) {
            return
        }

        chat.clearPendingScrollToBottom()

        nextTick(() => {
            listRef.current?.scrollToBottom("instant")
        })
    }, [snap.pendingScrollToBottom, chat, nextTick])

    if (!contactId) {
        return null
    }

    if (!threadScreenReady) {
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
                    setToast(null)
                    setReceiveModalOpen(true)
                }}
            />

            <ChatThreadMessageList
                ref={listRef}
                chat={chat}
                listDisabled={snap.isPendingList}
            />

            {toast && (
                <p className="shrink-0 border-b border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
                    {toast}
                </p>
            )}

            <ChatThreadComposer
                value={newMessageText}
                onChange={setNewMessageText}
                onSubmit={openSendModal}
            />

            <ChatSendEncryptedDialog
                open={sendModalOpen}
                onOpenChange={(nextOpen) => {
                    setSendModalOpen(nextOpen)

                    if (!nextOpen) {
                        sendNewMessage.reset()
                    }
                }}
                chat={chat}
                encryptedResult={sendNewMessage.data ?? null}
                onNotify={setToast}
                isPending={sendNewMessage.isPending}
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
