import { inject, injectable } from "inversify"
import { I18n } from "i18n-js"
import { proxy } from "valtio"

import { ILogger } from "@/di/types/logger"
import type { ILoggerFactory } from "../../logger/types"

import { ConfigProvider, type IConfigProvider } from "../../config/types"

import {
    type ILocalStorage,
    LocalStorageProvider,
} from "../../utils/local-storage/types"

import { invariant } from "@/lib/utils"

import {
    I18nTranslationsProvider,
    type I18nCurrencyCode,
    type I18nDirection,
    type I18nLocale_BCP47,
    type I18nLocale_POSIX,
    type I18nService,
    type I18nState,
    type I18nTranslations,
} from "../types"

const STORAGE_KEY = "i18n"
const VERSION = "1"

@injectable()
export class I18nJs implements I18nService {
    @inject(LocalStorageProvider)
    private readonly localStorage: ILocalStorage

    @inject(I18nTranslationsProvider)
    private readonly translations: I18nTranslations

    public state: I18nState
    public translator: I18n
    private logger: ILogger

    constructor(
        @inject("Factory<Logger>")
        private readonly loggerFactory: ILoggerFactory,
        @inject(ConfigProvider)
        private readonly config: IConfigProvider,
    ) {
        this.logger = this.loggerFactory("I18nJs", {
            level: this.config.logLevel,
        })
    }

    public async initialize(config: Partial<I18nState> = {}) {
        this.logger.info("Initializing i18n")

        const saved = await this.loadState()

        this.state = proxy({
            locale: "en-OM",
            direction: "ltr",
            currency: "OMR",
            ...(saved ?? {}),
            ...config,
        })

        await this.saveState(this.state)

        const [lang] = this.state.locale.split("-")

        this.translator = new I18n(this.translations, {
            defaultLocale: "en",
            locale: lang,
        })
    }

    private getStorageKey() {
        return `${STORAGE_KEY}_v${VERSION}`
    }

    public async saveState(state: I18nState): Promise<void> {
        const key = this.getStorageKey()
        return await this.localStorage.setItem(key, JSON.stringify(state))
    }

    public async loadState(): Promise<I18nState | null> {
        const key = this.getStorageKey()
        const value = await this.localStorage.getItem(key)

        if (!value) return null

        const state = JSON.parse(value) as Partial<I18nState>

        invariant(
            typeof state.locale === "string",
            "state.locale is not a string",
        )
        invariant(
            typeof state.direction === "string",
            "state.direction is not a string",
        )
        invariant(
            typeof state.currency === "string",
            "state.currency is not a string",
        )

        return state as I18nState
    }

    public t(key: string, options?: Record<string, unknown>): string {
        return this.translator.t(key, options)
    }

    public onChange(cb: () => void) {
        return this.translator.onChange(cb)
    }

    private toPosixFormat(locale: I18nLocale_BCP47): I18nLocale_POSIX {
        return locale.replace("-", "_") as I18nLocale_POSIX
    }

    public getPosixLocale(): I18nLocale_POSIX {
        return this.toPosixFormat(this.state.locale)
    }

    public getLocale(): I18nLocale_BCP47 {
        return this.state.locale
    }

    public getCurrency(): I18nCurrencyCode {
        return this.state.currency
    }

    public getDirection(): I18nDirection {
        return this.state.direction
    }
}
