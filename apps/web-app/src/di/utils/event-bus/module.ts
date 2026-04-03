import { ContainerModule } from "inversify"

import EventObserver from "./provider"
import { EventBusProvider, type IEventObserver } from "./types"

export const EventBusModule = new ContainerModule((ctx) => {
    ctx.bind<IEventObserver>(EventBusProvider).to(EventObserver).inSingletonScope()
})

