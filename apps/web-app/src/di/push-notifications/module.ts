import { ContainerModule } from "inversify"

import { PushNotificationsProvider } from "./push-notifications.provider"
import {
    PushNotificationsService,
    type IPushNotificationsService,
} from "./types"

export const PushNotificationsModule = new ContainerModule((ctx) => {
    ctx.bind<IPushNotificationsService>(PushNotificationsService)
        .to(PushNotificationsProvider)
        .inSingletonScope()
})
