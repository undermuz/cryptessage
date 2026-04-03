import { ContainerModule } from "inversify"

import { ConversationProvider } from "./conversation.provider"
import { ConversationService, type IConversationService } from "./types"

export const ConversationModule = new ContainerModule((ctx) => {
    ctx.bind<IConversationService>(ConversationService)
        .to(ConversationProvider)
        .inSingletonScope()
})
