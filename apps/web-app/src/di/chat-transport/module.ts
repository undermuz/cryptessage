import { ContainerModule } from "inversify"

import { ChatTransportRegistryProvider } from "./chat-transport-registry.provider"
import { ChatTransportManagerProvider } from "./chat-transport-manager.provider"
import { ChatTransportOutgoingStoreProvider } from "./outgoing-store.provider"
import { QrTextTransportProvider } from "./qr-text-transport.provider"
import { TransportPrefsProvider } from "./transport-prefs.provider"
import {
    ChatTransport,
    ChatTransportManager,
    ChatTransportOutgoingStore,
    ChatTransportRegistry,
    TransportPrefsService,
    type IChatTransport,
    type IChatTransportManager,
    type IChatTransportOutgoingStore,
    type IChatTransportRegistry,
    type ITransportPrefsService,
} from "./types"

export const ChatTransportModule = new ContainerModule((ctx) => {
    ctx.bind<IChatTransportOutgoingStore>(ChatTransportOutgoingStore)
        .to(ChatTransportOutgoingStoreProvider)
        .inSingletonScope()

    ctx.bind<ITransportPrefsService>(TransportPrefsService)
        .to(TransportPrefsProvider)
        .inSingletonScope()

    ctx.bind<IChatTransport>(ChatTransport)
        .to(QrTextTransportProvider)
        .inSingletonScope()

    ctx.bind<IChatTransportRegistry>(ChatTransportRegistry)
        .to(ChatTransportRegistryProvider)
        .inSingletonScope()

    ctx.bind<IChatTransportManager>(ChatTransportManager)
        .to(ChatTransportManagerProvider)
        .inSingletonScope()
})
