import { Container } from "inversify"

/* MODULES */
// import { MyModule } from "./my-provider/module"
import { LogTapeModule } from "./logger/logtape/logtape.module"
import { EnvViteModule } from "./env/vite/module"
import { BrowserLocalStorageModule } from "./utils/local-storage/browser-local-storage/module"
import { CacheModule } from "./utils/cache/module"
import { EventBusModule } from "./utils/event-bus/module"
import { TimersModule } from "./utils/timers/module"
import { MiddlewareModule } from "./utils/middleware/module"
import { I18nJsModule } from "./i18n/i18n-js/i18n.module"
import { ConfigModule } from "./config/config.module"

export const createDiContainer = () => {
    const di: Container = new Container()

    // di.load(MyModule)
    di.load(LogTapeModule)
    di.load(EnvViteModule)
    di.load(BrowserLocalStorageModule)
    di.load(CacheModule)
    di.load(EventBusModule)
    di.load(TimersModule)
    di.load(MiddlewareModule)
    di.load(I18nJsModule)
    di.load(ConfigModule)

    return di
}
