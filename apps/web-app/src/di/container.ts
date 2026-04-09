import { Container } from "inversify"
import { QueryClient } from "@tanstack/react-query"

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
import { CryptDbModule } from "./crypt-db/module"
import { AuthModule } from "./auth/module"
import { IdentityModule } from "./identity/module"
import { OpenPgpCryptoModule } from "./openpgp-crypto/module"
import { CryptoPrefsModule } from "./crypto-prefs/module"
import { MessagingCryptoModule } from "./messaging-crypto/module"
import { VaultBackupModule } from "./vault-backup/module"
import { ConversationModule } from "./conversation/module"
import { ChatThreadModule } from "./chat-thread/module"
import { AppModule } from "./app/app.module"
import { PromiseManagerModule } from "./utils/promise-manager/module"

export const createDiContainer = () => {
    const di: Container = new Container()

    di.bind<QueryClient>("QueryClient").toConstantValue(new QueryClient())

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
    di.load(CryptDbModule)
    di.load(AuthModule)
    di.load(IdentityModule)
    di.load(OpenPgpCryptoModule)
    di.load(CryptoPrefsModule)
    di.load(MessagingCryptoModule)
    di.load(VaultBackupModule)
    di.load(ConversationModule)
    di.load(ChatThreadModule)
    di.load(AppModule)
    di.load(PromiseManagerModule)

    return di
}
