import { forwardRef } from "react"
import BidirectionalList, {
    type BidirectionalListProps,
    type BidirectionalListRef,
} from "broad-infinite-list/react"
import type { MessagePlain } from "@/di/crypt-db/types-data"
import { useT } from "@/di/react/hooks/useT"

import { ChatMessageBubble } from "./chat-message-bubble"
import { LIST_THRESHOLD, VIEW_COUNT } from "./constants"
import type { DecryptPreviewState } from "./types"

type ChatThreadMessageListProps = {
    listItems: MessagePlain[]
    listDisable: boolean
    hasPrevious: boolean
    hasNext: boolean
    onLoadMore: BidirectionalListProps<MessagePlain>["onLoadMore"]
    onItemsChange: (items: MessagePlain[]) => void
    showJumpToBottom: boolean
    onJumpToBottom: () => void
    inboundPreview: Record<string, DecryptPreviewState>
    outboundPreview: Record<string, DecryptPreviewState>
}

export const ChatThreadMessageList = forwardRef<
    BidirectionalListRef<MessagePlain>,
    ChatThreadMessageListProps
>(function ChatThreadMessageList(
    {
        listItems,
        listDisable,
        hasPrevious,
        hasNext,
        onLoadMore,
        onItemsChange,
        showJumpToBottom,
        onJumpToBottom,
        inboundPreview,
        outboundPreview,
    },
    ref,
) {
    const t = useT()

    return (
        <>
            <BidirectionalList<MessagePlain>
                ref={ref}
                items={listItems}
                itemKey={(m) => m.id}
                useWindow={false}
                hasPrevious={hasPrevious}
                hasNext={hasNext}
                viewCount={VIEW_COUNT}
                threshold={LIST_THRESHOLD}
                onLoadMore={onLoadMore}
                onItemsChange={onItemsChange}
                disable={listDisable}
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
                    `flex px-3 py-1.5 ${m.direction === "out" ? "justify-end" : "justify-start"}`
                }
                renderItem={(m) => (
                    <ChatMessageBubble
                        message={m}
                        inboundPreview={inboundPreview}
                        outboundPreview={outboundPreview}
                    />
                )}
            />

            {showJumpToBottom && (
                <button
                    type="button"
                    onClick={onJumpToBottom}
                    className="absolute bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] left-1/2 z-10 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg transition hover:opacity-90 active:scale-[0.98]"
                >
                    {t("chat.scrollToBottom")} ↓
                </button>
            )}
        </>
    )
})
