import { ContainerModule } from "inversify"
import { App } from "./app.provider"

import { AppProvider, IAppProvider } from "./types"

export const AppModule = new ContainerModule((ctx) => {
    ctx.bind<IAppProvider>(AppProvider).to(App).inSingletonScope()
})
