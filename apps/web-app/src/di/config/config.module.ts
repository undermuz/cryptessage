import { ContainerModule } from "inversify"

import { ConfigProvider } from "./types"

import { AppConfig } from "./config.provider"
import { ConfigLoggerProvider } from "./config-logger.provider"

export const ConfigModule = new ContainerModule((ctx) => {
    ctx.bind<AppConfig>(ConfigProvider).to(AppConfig).inSingletonScope()
    ctx.bind<ConfigLoggerProvider>(ConfigLoggerProvider)
        .to(ConfigLoggerProvider)
        .inSingletonScope()
})
