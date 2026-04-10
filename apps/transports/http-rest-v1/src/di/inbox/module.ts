import { ContainerModule } from "inversify"

import { InboxController } from "./inbox.provider.js"

export const InboxModule = new ContainerModule((ctx) => {
    ctx.bind(InboxController).toSelf()
})
