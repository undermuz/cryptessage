import { ContainerModule } from "inversify"

import { MiddlewareService } from "./provider"
import { MiddlewareProvider, type IMiddlewareService } from "./types"

export const MiddlewareModule = new ContainerModule((ctx) => {
    ctx.bind<IMiddlewareService>(MiddlewareProvider)
        .to(MiddlewareService)
        .inSingletonScope()
})

