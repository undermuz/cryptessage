import { ContainerModule } from "inversify"

import { InMemoryProvider } from "./in-memory.provider.js"
import { InMemoryService, type IInMemoryService } from "./types.js"

export const InMemoryModule = new ContainerModule((ctx) => {
    ctx.bind<IInMemoryService>(InMemoryService)
        .to(InMemoryProvider)
        .inSingletonScope()
})
