import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { useNextTickLayout } from "use-next-tick"

import type { BidirectionalListRef } from "broad-infinite-list/react"
import { Button, Card, Spinner, Surface } from "@heroui/react"

import { QR_TEXT_TRANSPORT_KIND } from "@/di/chat-transport/constants"
import {
    ChatTransportManager,
    ChatTransportOutgoingStore,
    type IChatTransportManager,
    type IChatTransportOutgoingStore,
} from "@/di/chat-transport/types"
import { useDi } from "@/di/react/hooks/useDi"
import { useT } from "@/di/react/hooks/useT"
import { useChatThread } from "@/di/react/hooks/useChatThread"
import {
    EventBusProvider,
    type IEventObserver,
} from "@/di/utils/event-bus/types"
import {
    ConversationService,
    type IConversationService,
} from "@/di/conversation/types"
import type { MessagePlain } from "@/di/crypt-db/types-data"
import type { DecryptedMessageItem } from "@/di/chat-thread/types"

import { ChatThreadHeader } from "./components/chat-thread-header"
import { ChatThreadComposer } from "./components/chat-thread-composer"
import { ChatThreadMessageList } from "./components/chat-thread-message-list"
import { ChatSendEncryptedModal } from "./modals/chat-send-encrypted-modal"
import { ChatReceiveEncryptedModal } from "./modals/chat-receive-encrypted-modal"

export function ChatThreadWidget() {
    const t = useT()
    const nextTick = useNextTickLayout()

    const { chat, snap } = useChatThread()
    const events = useDi<IEventObserver>(EventBusProvider)
    const conv = useDi<IConversationService>(ConversationService)
    const transportMgr = useDi<IChatTransportManager>(ChatTransportManager)
    const outgoing = useDi<IChatTransportOutgoingStore>(ChatTransportOutgoingStore)

    const { contactId } = useParams({ from: "/authed/chat/$contactId" })
    const navigate = useNavigate()

    const listRef = useRef<BidirectionalListRef<DecryptedMessageItem>>(null)

    const [threadScreenReady, setThreadScreenReady] = useState(false)

    const [sendModalOpen, setSendModalOpen] = useState(false)
    const [receiveModalOpen, setReceiveModalOpen] = useState(false)
    const [newMessageText, setNewMessageText] = useState("")
    const [toast, setToast] = useState<string | null>(null)
    const [sentPreviewOpen, setSentPreviewOpen] = useState(false)
    const [sentPreviewMessage, setSentPreviewMessage] =
        useState<MessagePlain | null>(null)
    const [sendModalTransportId, setSendModalTransportId] = useState<
        string | null
    >(null)
    const [previewModalTransportId, setPreviewModalTransportId] = useState<
        string | null
    >(null)

    const setActiveContactId = useMutation({
        mutationFn: (id: string | null) => chat.setActiveContactId(id),
    })

    const sendNewMessage = useMutation({
        mutationFn: (messageText: string) => chat.onSendNewMessage(messageText),
        onSuccess: async ({ bundle, messageId }) => {
            setNewMessageText("")

            const c = chat.state.contact

            if (c) {
                try {
                    const r = await transportMgr.send(
                        c,
                        bundle,
                    )

                    const last = outgoing.state.lastNetworkDelivery
                    const requiresUserAction =
                        r.usedKind === QR_TEXT_TRANSPORT_KIND || last === null

                    if (requiresUserAction) {
                        await conv.setOutboundTransportState(
                            messageId,
                            "needs_action",
                            { kind: r.usedKind },
                        )
                        setSendModalTransportId(r.usedInstanceId)
                        setSendModalOpen(true)
                    } else {
                        await conv.setOutboundTransportState(
                            messageId,
                            "sent",
                            { kind: r.usedKind, status: last.status },
                        )
                    }

                    await chat.reload()
                } catch (e) {
                    const reason = e instanceof Error ? e.message : String(e)

                    setToast(reason)
                    await conv.setOutboundTransportState(messageId, "failed")
                    setSendModalOpen(true)
                    await chat.reload()
                }
            }
        },
        onError: () => {
            setSendModalOpen(false)
        },
    })

    const sentEncryptedResult = useMutation({
        mutationFn: async (plain: string) => {
            if (!contactId) {
                throw new Error("Missing contactId")
            }

            return await conv.encryptOutgoingBundle(contactId, plain)
        },
        onSuccess: async (bundle) => {
            const c = chat.state.contact

            if (c) {
                const r = await transportMgr.send(
                    c,
                    bundle,
                )

                setPreviewModalTransportId(r.usedInstanceId)
            }
        },
        onError: (e) => {
            const reason = e instanceof Error ? e.message : String(e)

            setToast(reason)
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
        sendNewMessageMutate(sendMessageText)
    }, [newMessageText, sendNewMessageMutate])

    useEffect(() => {
        const onToast = (message: string | null) => {
            setToast(message)
        }

        const onOpenQrReceive = () => {
            setToast(null)
            setReceiveModalOpen(true)
        }

        events.on("chatThread:toast", onToast)
        events.on("chatTransport:openQrReceive", onOpenQrReceive)

        return () => {
            events.off("chatThread:toast", onToast)
            events.off("chatTransport:openQrReceive", onOpenQrReceive)
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
        // Wait until the message list is mounted: Valtio can update `pendingScrollToBottom`
        // before `threadScreenReady` flips true, so scrolling earlier would clear the flag
        // with a null list ref and never scroll after mount.
        if (!threadScreenReady || !snap.contact) {
            return
        }

        if (!snap.pendingScrollToBottom) {
            return
        }

        chat.clearPendingScrollToBottom()

        nextTick(() => {
            listRef.current?.scrollToBottom("instant")
        })
    }, [threadScreenReady, snap.contact, snap.pendingScrollToBottom, chat, nextTick])

    if (!contactId) {
        return null
    }

    if (!threadScreenReady) {
        return (
            <Surface
                className="flex min-h-[200px] items-center justify-center gap-3 rounded-3xl border border-divider p-8"
                variant="default"
            >
                <Spinner size="sm" />
                <span className="text-sm text-default-500">
                    {t("common.loading")}
                </span>
            </Surface>
        )
    }

    if (!snap.contact) {
        return (
            <Surface
                className="space-y-3 rounded-3xl border border-divider p-6"
                variant="default"
            >
                <div className="flex items-start gap-3">
                    <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        aria-label={t("chat.back")}
                        onPress={() => void navigate({ to: "/" })}
                    >
                        <ArrowLeft className="size-5" />
                    </Button>
                    <p className="min-w-0 flex-1 text-sm text-default-500">
                        {t("unlock.error.generic")}
                    </p>
                </div>
            </Surface>
        )
    }

    return (
        <Card className="relative flex h-[calc(100dvh-9.5rem)] max-h-[800px] min-h-[420px] flex-col overflow-hidden rounded-3xl border border-divider shadow-lg ring-1 ring-black/5 dark:ring-white/10">
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <ChatThreadMessageList
                    ref={listRef}
                    chat={chat}
                    listDisabled={snap.isPendingList}
                    listClassName="pt-[max(5.5rem,env(safe-area-inset-top,0px)+4.75rem)] pb-[max(10rem,env(safe-area-inset-bottom,0px)+8.5rem)]"
                    onOutboundMessageClick={(item: DecryptedMessageItem) => {
                        const m = item.message

                        setToast(null)

                        if (!item.decrypted) {
                            setToast(t("common.loading"))
                            return
                        }

                        if (!item.decrypted.ok) {
                            setToast(item.decrypted.err)
                            return
                        }

                        setSentPreviewMessage(m)
                        setSentPreviewOpen(true)
                        sentEncryptedResult.mutate(item.decrypted.text)
                    }}
                />

                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:px-4">
                    <div className="pointer-events-auto w-full max-w-3xl">
                        <ChatThreadHeader
                            chat={chat}
                            onReceiveClick={() => {
                                setToast(null)
                                setReceiveModalOpen(true)
                            }}
                        />
                    </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col-reverse items-stretch gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
                    <div className="pointer-events-auto mx-auto w-full max-w-3xl">
                        <ChatThreadComposer
                            value={newMessageText}
                            onChange={setNewMessageText}
                            onSubmit={openSendModal}
                        />
                    </div>
                    {toast && (
                        <div className="pointer-events-auto mx-auto w-full max-w-3xl rounded-2xl border border-divider bg-default-100/95 px-4 py-2.5 shadow-lg ring-1 ring-black/5 backdrop-blur-md dark:bg-default-50/95 dark:ring-white/10">
                            <p className="text-center text-xs leading-relaxed text-default-600">
                                {toast}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <ChatSendEncryptedModal
                open={sendModalOpen}
                onOpenChange={(nextOpen) => {
                    setSendModalOpen(nextOpen)

                    if (!nextOpen) {
                        setSendModalTransportId(null)
                        transportMgr.clearOutgoing()
                        sendNewMessage.reset()
                    }
                }}
                chat={chat}
                encryptedResult={sendNewMessage.data?.bundle ?? null}
                onNotify={setToast}
                isPending={sendNewMessage.isPending}
                initialTransportInstanceId={sendModalTransportId}
            />

            {sentPreviewMessage && (
                <ChatSendEncryptedModal
                    open={sentPreviewOpen}
                    onOpenChange={(nextOpen) => {
                        setSentPreviewOpen(nextOpen)

                        if (!nextOpen) {
                            setPreviewModalTransportId(null)
                            transportMgr.clearOutgoing()
                            sentEncryptedResult.reset()
                            setSentPreviewMessage(null)
                        }
                    }}
                    chat={chat}
                    encryptedResult={sentEncryptedResult.data ?? null}
                    onNotify={setToast}
                    isPending={sentEncryptedResult.isPending}
                    initialTransportInstanceId={previewModalTransportId}
                />
            )}

            <ChatReceiveEncryptedModal
                open={receiveModalOpen}
                onOpenChange={setReceiveModalOpen}
                chat={chat}
                onSaved={() => setReceiveModalOpen(false)}
            />
        </Card>
    )
}

