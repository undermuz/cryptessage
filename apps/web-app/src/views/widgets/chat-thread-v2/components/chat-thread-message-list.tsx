import { forwardRef } from "react"
import { MessageSquare } from "lucide-react"
import { Button, Spinner } from "@heroui/react"
import BidirectionalList, { type BidirectionalListRef } from "broad-infinite-list/react"
import { useSnapshot } from "valtio/react"

import type { DecryptedMessageItem, IChatThreadService } from "@/di/chat-thread/types"
import { LIST_THRESHOLD, VIEW_COUNT } from "@/di/chat-thread/constants"
import { useT } from "@/di/react/hooks/useT"

import { ChatMessageBubble } from "../chat-message-bubble"

export const ChatThreadMessageListHeroUI = forwardRef<
    BidirectionalListRef<DecryptedMessageItem>,
    {
        chat: IChatThreadService
        listDisabled: boolean
        onOutboundMessageClick?: (message: DecryptedMessageItem) => void
    }
>(function ChatThreadMessageListHeroUI(
    { chat, listDisabled, onOutboundMessageClick },
    ref,
) {
    const t = useT()
    const snap = useSnapshot(chat.state)

    const hasPrevious =
        snap.decryptedMessages.length > 0 &&
        snap.decryptedMessages[0]?.message.id !== snap.encryptedMessages[0]?.id

    const hasNext =
        snap.decryptedMessages.length > 0 &&
        snap.decryptedMessages[snap.decryptedMessages.length - 1]?.message.id !==
            snap.encryptedMessages[snap.encryptedMessages.length - 1]?.id

    const showJumpToBottom =
        snap.decryptedMessages.length > 0 &&
        snap.decryptedMessages[snap.decryptedMessages.length - 1]?.message.id !==
            snap.encryptedMessages[snap.encryptedMessages.length - 1]?.id

    return (
        <>
            <BidirectionalList<DecryptedMessageItem>
                ref={ref}
                items={chat.state.decryptedMessages}
                itemKey={(m) => m.message.id}
                useWindow={false}
                hasPrevious={hasPrevious}
                hasNext={hasNext}
                viewCount={VIEW_COUNT}
                threshold={LIST_THRESHOLD}
                onLoadMore={chat.loadMore}
                onItemsChange={(items) => chat.setDecryptedMessages(items)}
                disable={listDisabled}
                spinnerRow={
                    <div className="flex justify-center py-4">
                        <Spinner size="sm" />
                    </div>
                }
                emptyState={
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-default-100 text-default-400">
                            <MessageSquare className="size-6" aria-hidden />
                        </div>
                        <p className="max-w-[16rem] text-sm leading-relaxed text-default-500">
                            {t("chat.emptyThread")}
                        </p>
                    </div>
                }
                className="isolate min-h-0 flex-1 bg-gradient-to-b from-default-50/80 to-default-100/60"
                as="ul"
                itemAs="li"
                itemClassName={(m) =>
                    `flex px-3 py-2 sm:px-4 ${
                        m.message.direction === "out"
                            ? "justify-end"
                            : "justify-start"
                    }`
                }
                renderItem={(m) => (
                    <ChatMessageBubble
                        item={m}
                        chat={chat}
                        onClick={
                            m.message.direction === "out"
                                ? () => onOutboundMessageClick?.(m)
                                : undefined
                        }
                    />
                )}
            />

            {showJumpToBottom && (
                <div className="pointer-events-auto absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-10 -translate-x-1/2">
                    <Button
                        variant="primary"
                        size="sm"
                        className="shadow-lg shadow-black/10"
                        onPress={() => chat.jumpListToBottom()}
                    >
                        {t("chat.scrollToBottom")} ↓
                    </Button>
                </div>
            )}
        </>
    )
})

