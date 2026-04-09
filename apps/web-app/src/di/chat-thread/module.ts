import { ContainerModule } from "inversify"

import { ChatThreadProvider } from "./chat-thread.provider"
import { ChatThreadDecryptProvider } from "./chat-thread-decrypt.provider"
import {
    ChatThreadDecryptService,
    ChatThreadService,
    type IChatThreadDecryptService,
    type IChatThreadService,
} from "./types"

export const ChatThreadModule = new ContainerModule((ctx) => {
    ctx.bind<IChatThreadDecryptService>(ChatThreadDecryptService)
        .to(ChatThreadDecryptProvider)
        .inSingletonScope()

    ctx.bind<IChatThreadService>(ChatThreadService)
        .to(ChatThreadProvider)
        .inSingletonScope()
})
