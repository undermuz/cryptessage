import { ContainerModule, Factory } from "inversify"

import { ChatTransport, type IChatTransport } from "@/di/chat-transport/types"

import { HttpRestInboundCoordinatorProvider } from "./inbound-coordinator.provider"
import {
    HttpRestOutboxSubscription,
    type CreateHttpRestOutboxSubscription,
} from "./http-rest-outbox-subscription"
import { HttpRestPowHeadersProvider } from "./pow-headers.provider"
import { HttpRestTransportProvider } from "./transport.provider"
import {
    HttpRestInboundCoordinator,
    type IHttpRestInboundCoordinator,
} from "./types"

/**
 * Binds {@link HttpRestTransportProvider} as a multi-injected {@link IChatTransport}
 * and {@link HttpRestInboundCoordinatorProvider} as {@link IHttpRestInboundCoordinator}.
 */
export const HttpRestV1TransportModule = new ContainerModule((ctx) => {
    ctx.bind(HttpRestPowHeadersProvider).toSelf().inSingletonScope()

    ctx.bind(HttpRestOutboxSubscription).toSelf().inTransientScope()

    ctx.bind<Factory<HttpRestOutboxSubscription>>(
        "Factory<HttpRestOutboxSubscription>",
    ).toFactory(
        (context) =>
            (...args: Parameters<CreateHttpRestOutboxSubscription>) => {
                const subscription = context.get(HttpRestOutboxSubscription)

                subscription.initialize(...args)

                return subscription
            },
    )

    ctx.bind<IChatTransport>(ChatTransport)
        .to(HttpRestTransportProvider)
        .inSingletonScope()

    ctx.bind<IHttpRestInboundCoordinator>(HttpRestInboundCoordinator)
        .to(HttpRestInboundCoordinatorProvider)
        .inSingletonScope()
})
