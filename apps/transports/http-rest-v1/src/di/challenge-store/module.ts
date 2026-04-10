import { ContainerModule } from "inversify"

import { ChallengeStoreProvider } from "./challenge-store.provider.js"
import { ChallengeStore, type IChallengeStore } from "./types.js"

export const ChallengeStoreModule = new ContainerModule((ctx) => {
    ctx.bind<IChallengeStore>(ChallengeStore)
        .to(ChallengeStoreProvider)
        .inSingletonScope()
})
