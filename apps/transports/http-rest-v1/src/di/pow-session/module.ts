import { ContainerModule } from "inversify"

import { PowSessionProvider } from "./pow-session.provider.js"
import { PowSession, type IPowSessionService } from "./types.js"

export const PowSessionModule = new ContainerModule((ctx) => {
    ctx.bind<IPowSessionService>(PowSession)
        .to(PowSessionProvider)
        .inSingletonScope()
})
