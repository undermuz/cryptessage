import { inject, injectable } from "inversify"
import { type QueryClient } from "@tanstack/react-query"

import type { IAppProvider } from "./types"
import { ConfigProvider } from "../config/types"

import type { ILoggerFactory } from "@/di/logger/types"

import { type ICacheProvider, CacheProvider } from "@/di/utils/cache/types"
import { type I18nService, I18nProvider } from "@/di/i18n/types"

import {
    type ILocalStorage,
    LocalStorageProvider,
} from "@/di/utils/local-storage/types"

import { ConfigLoggerProvider } from "../config/config-logger.provider"

import { type AppConfig } from "../config/config.provider"
import type { ILogger } from "../types/logger"

@injectable()
export class App implements IAppProvider {
    @inject(LocalStorageProvider)
    private readonly localStorage: ILocalStorage

    @inject(I18nProvider)
    public readonly i18nProvider: I18nService

    @inject(ConfigLoggerProvider)
    private readonly configLogger: ConfigLoggerProvider

    private readonly logger: ILogger

    @inject("QueryClient")
    public readonly queryClient: QueryClient

    @inject(CacheProvider)
    private readonly cacheService: ICacheProvider

    constructor(
        @inject(ConfigProvider)
        public readonly config: AppConfig,
        @inject("Factory<Logger>")
        private readonly loggerFactory: ILoggerFactory,
    ) {
        this.logger = this.loggerFactory("App", {
            level: this.config.logLevel,
        })
    }

    private _initializePromise: Promise<void> | null = null

    public async initialize() {
        if (!this._initializePromise) {
            this._initializePromise = this._initialize()
        }

        return this._initializePromise
    }

    private async _initialize() {
        await this.configLogger.initialize()

        this.logger.info("[init] start")

        await this.localStorage.initialize({
            prefix: "courier_v1:",
        })

        this.logger.info("[init] local storage ✅")

        await this.cacheService.initialize({
            prefix: "cache_v1:",
            ttl: 1000 * 60 * 5,
        })

        this.logger.info("[init] cache service ✅")

        await this.i18nProvider.initialize()

        this.logger.info("[init] i18n service ✅")

        this.logger.info("[init] done ✅")
    }
}
