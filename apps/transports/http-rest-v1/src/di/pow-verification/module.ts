import { ContainerModule } from "inversify"

import { PowVerificationProvider } from "./pow-verification.provider.js"
import { PowVerification, type IPowVerification } from "./types.js"

export const PowVerificationModule = new ContainerModule((ctx) => {
    ctx.bind<IPowVerification>(PowVerification)
        .to(PowVerificationProvider)
        .inSingletonScope()
})
