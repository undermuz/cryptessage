import { Initializable } from "../types/initializable"
import { PersistState } from "../types/persist-state"
import { Stateful } from "../types/stateful"

export const I18nProvider = Symbol.for("I18nProvider")
export const I18nTranslationsProvider = Symbol.for("I18nTranslationsProvider")

export type I18nLanguageCode = "ar" | "en"
export type I18nCountryCode = "OM" | "US"
export type I18nDirection = "rtl" | "ltr"
export type I18nCurrencyCode = "OMR" | "USD" | "EUR"

export type I18n_Language_ISO_639_1 = "ru" | "uk" | "tr" | "en" | "he"
export type I18n_Language_ISO_3166_1 = "RU" | "UA" | "TR" | "US" | "IL"

export type I18nLocale_BCP47 =
    `${Lowercase<I18nLanguageCode>}-${Uppercase<I18nCountryCode>}`

export type I18nLocale_POSIX =
    `${Lowercase<I18n_Language_ISO_639_1>}_${Uppercase<I18n_Language_ISO_3166_1>}`

export type I18nState = {
    locale: I18nLocale_BCP47
    direction: I18nDirection
    currency: I18nCurrencyCode
}

export type I18nTranslations = Record<string, Record<string, unknown>>

export type I18nService = Initializable &
    Stateful<I18nState> &
    PersistState<I18nState> & {
        t: (key: string, options?: Record<string, unknown>) => string
        onChange: (cb: () => void) => () => void
        getPosixLocale: () => I18nLocale_POSIX
        getLocale: () => I18nLocale_BCP47
        getCurrency: () => I18nCurrencyCode
        getDirection: () => I18nDirection
    }
