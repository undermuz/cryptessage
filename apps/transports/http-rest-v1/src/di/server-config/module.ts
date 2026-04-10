import { ContainerModule } from "inversify"

import { ServerConfig, type ServerEnv } from "./types.js"

export function createServerConfigModule(
    config: ServerEnv,
): ContainerModule {
    return new ContainerModule((ctx) => {
        ctx.bind<ServerEnv>(ServerConfig).toConstantValue(config)
    })
}
