import { ContainerModule } from "inversify"

import { I18nJs } from "./i18n.provider"
import {
    I18nProvider,
    I18nTranslationsProvider,
    type I18nService,
    type I18nTranslations,
} from "../types"

import en from "./en.json"

export const I18nJsModule = new ContainerModule((ctx) => {
    ctx.bind<I18nTranslations>(I18nTranslationsProvider).toConstantValue({
        en: en as Record<string, unknown>,
    })
    ctx.bind<I18nService>(I18nProvider).to(I18nJs).inSingletonScope()
})
