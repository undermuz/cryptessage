import { ContainerModule } from "inversify"

import { OpenPgpCryptoProvider } from "./openpgp-crypto.provider"
import {
    OpenPgpCryptoService,
    type IOpenPgpCryptoService,
} from "./types"

export const OpenPgpCryptoModule = new ContainerModule((ctx) => {
    ctx.bind<IOpenPgpCryptoService>(OpenPgpCryptoService)
        .to(OpenPgpCryptoProvider)
        .inSingletonScope()
})
