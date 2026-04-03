import { ContainerModule, Factory } from "inversify"
import type { ILogger } from "../../types/logger"

import { logTapeFactory } from "./logtape.factory"
import { ILoggerSettings } from "../types"

export const LogTapeModule = new ContainerModule(({ bind }) => {
    bind<Factory<ILogger>>("Factory<Logger>").toFactory(
        (ctx) => (name: string, settings?: ILoggerSettings) => {
            const commonSettings =
                ctx.get<ILoggerSettings>("LoggerCommonSettings", {
                    optional: true,
                }) ?? {}

            return logTapeFactory(name, {
                ...commonSettings,
                ...settings,
            })
        },
    )
})
