import { ContainerModule } from "inversify"

import { OutboxCursorProvider } from "./outbox-cursor.provider.js"
import { OutboxCursor, type IOutboxCursor } from "./types.js"

export const OutboxCursorModule = new ContainerModule((ctx) => {
    ctx.bind<IOutboxCursor>(OutboxCursor)
        .to(OutboxCursorProvider)
        .inSingletonScope()
})
