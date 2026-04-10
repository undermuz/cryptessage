import { ContainerModule } from "inversify"

import { LocalHostRequestProvider } from "./local-host-request.provider.js"
import { LocalHostRequest, type ILocalHostRequest } from "./types.js"

export const LocalHostRequestModule = new ContainerModule((ctx) => {
    ctx.bind<ILocalHostRequest>(LocalHostRequest)
        .to(LocalHostRequestProvider)
        .inSingletonScope()
})
