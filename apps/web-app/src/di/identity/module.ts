import { ContainerModule } from "inversify"

import { IdentityProvider } from "./identity.provider"
import { IdentityService, type IIdentityService } from "./types"

export const IdentityModule = new ContainerModule((ctx) => {
    ctx.bind<IIdentityService>(IdentityService).to(IdentityProvider).inSingletonScope()
})
