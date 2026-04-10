import { ContainerModule } from "inversify"

import { HttpRequestAuthProvider } from "./http-request-auth.provider.js"
import { HttpRequestAuth, type IHttpRequestAuth } from "./types.js"

export const HttpRequestAuthModule = new ContainerModule((ctx) => {
    ctx.bind<IHttpRequestAuth>(HttpRequestAuth)
        .to(HttpRequestAuthProvider)
        .inSingletonScope()
})
