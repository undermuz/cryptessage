import { ContainerModule } from "inversify"

import { IdempotencyStoreProvider } from "./idempotency-store.provider.js"
import { IdempotencyStore, type IIdempotencyStore } from "./types.js"

export const IdempotencyStoreModule = new ContainerModule((ctx) => {
    ctx.bind<IIdempotencyStore>(IdempotencyStore)
        .to(IdempotencyStoreProvider)
        .inSingletonScope()
})
