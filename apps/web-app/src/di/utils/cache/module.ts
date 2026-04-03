import { ContainerModule } from "inversify"

import { CacheService } from "./provider"

import { CacheProvider, type ICacheProvider } from "./types"

export const CacheModule = new ContainerModule((ctx) => {
    ctx.bind<ICacheProvider>(CacheProvider).to(CacheService).inSingletonScope()
})
