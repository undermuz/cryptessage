import { ContainerModule } from "inversify"

import { MessagingCryptoProvider } from "./messaging-crypto.provider"
import {
    MessagingCryptoService,
    type IMessagingCryptoService,
} from "./types"

export const MessagingCryptoModule = new ContainerModule((ctx) => {
    ctx.bind<IMessagingCryptoService>(MessagingCryptoService)
        .to(MessagingCryptoProvider)
        .inSingletonScope()
})
