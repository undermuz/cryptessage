import { ContainerModule } from "inversify"

import { PromiseManager } from "./provider"
import { PromiseManagerProvider } from "./types"

export const PromiseManagerModule = new ContainerModule((ctx) => {
    ctx.bind<PromiseManager>(PromiseManagerProvider).to(PromiseManager).inSingletonScope()
})
