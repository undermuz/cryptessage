import { ContainerModule } from "inversify"

import { I18nJs } from "./i18n.provider"
import { I18nProvider, type I18nService } from "../types"

export const I18nJsModule = new ContainerModule((ctx) => {
    ctx.bind<I18nService>(I18nProvider).to(I18nJs).inSingletonScope()
})
