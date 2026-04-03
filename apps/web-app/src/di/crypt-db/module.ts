import { ContainerModule } from "inversify"

import { CryptDb } from "./crypt-db.provider"
import { CryptDbProvider, type CryptDbService } from "./types"

export const CryptDbModule = new ContainerModule((ctx) => {
    ctx.bind<CryptDbService>(CryptDbProvider).to(CryptDb).inSingletonScope()
})
