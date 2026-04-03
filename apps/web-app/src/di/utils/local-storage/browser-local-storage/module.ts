import { ContainerModule } from "inversify"
import { BrowserLocalStorageProvider } from "./provider"

import { LocalStorageProvider, ILocalStorage } from "../types"

export const BrowserLocalStorageModule = new ContainerModule((ctx) => {
    ctx.bind<ILocalStorage>(LocalStorageProvider)
        .to(BrowserLocalStorageProvider)
        .inSingletonScope()
})
