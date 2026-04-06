import { ContainerModule } from "inversify"

import { CryptoPrefsProvider } from "./crypto-prefs.provider"
import { CryptoPrefsService, type ICryptoPrefsService } from "./types"

export const CryptoPrefsModule = new ContainerModule((ctx) => {
    ctx.bind<ICryptoPrefsService>(CryptoPrefsService)
        .to(CryptoPrefsProvider)
        .inSingletonScope()
})
