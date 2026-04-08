import { ContainerModule } from "inversify"

import { ChatThreadProvider } from "./chat-thread.provider"
import { ChatThreadService, type IChatThreadService } from "./types"

export const ChatThreadModule = new ContainerModule((ctx) => {
    ctx.bind<IChatThreadService>(ChatThreadService)
        .to(ChatThreadProvider)
        .inSingletonScope()
})
