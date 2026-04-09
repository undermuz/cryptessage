import { forwardRef } from "react"
import BidirectionalList, {
    type BidirectionalListRef,
} from "broad-infinite-list/react"
import { useT } from "@/di/react/hooks/useT"
import { useSnapshot } from "valtio/react"

import { ChatMessageBubble } from "./chat-message-bubble"
import { LIST_THRESHOLD, VIEW_COUNT } from "@/di/chat-thread/constants"
import type { DecryptedMessageItem, IChatThreadService } from "@/di/chat-thread/types"

type ChatThreadMessageListProps = {
    chat: IChatThreadService
    listDisabled: boolean
    onOutboundMessageClick?: (message: DecryptedMessageItem) => void
}

export const ChatThreadMessageList = forwardRef<
    BidirectionalListRef<DecryptedMessageItem>,
    ChatThreadMessageListProps
>(function ChatThreadMessageList(
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
                    <div className="flex justify-center py-3">
                        <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                }
                emptyState={
                    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
                        {t("chat.emptyThread")}
                    </div>
                }
                className="isolate min-h-0 flex-1 bg-muted/25"
                as="ul"
                itemAs="li"
                itemClassName={(m) =>
                    `flex px-3 py-1.5 ${m.message.direction === "out" ? "justify-end" : "justify-start"}`
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
                <button
                    type="button"
                    onClick={() => chat.jumpListToBottom()}
                    className="absolute bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg transition hover:opacity-90 active:scale-[0.98]"
                >
                    {t("chat.scrollToBottom")} ↓
                </button>
            )}
        </>
    )
})
