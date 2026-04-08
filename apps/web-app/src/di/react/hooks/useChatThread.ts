import { useSnapshot } from "valtio/react"
import type { Snapshot } from "valtio/vanilla"

import { useDi } from "./useDi"

import {
    ChatThreadService,
    type ChatThreadState,
    type IChatThreadService,
} from "@/di/chat-thread/types"

export function useChatThread(): {
    chat: IChatThreadService
    snap: Snapshot<ChatThreadState>
} {
    const chat = useDi<IChatThreadService>(ChatThreadService)
    const snap = useSnapshot(chat.state as ChatThreadState)

    return { chat, snap }
}
