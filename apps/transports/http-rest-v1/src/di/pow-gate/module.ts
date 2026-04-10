import { ContainerModule } from "inversify"

import { PowGateProvider } from "./pow-gate.provider.js"
import { PowGate, type IPowGate } from "./types.js"

export const PowGateModule = new ContainerModule((ctx) => {
    ctx.bind<IPowGate>(PowGate).to(PowGateProvider).inSingletonScope()
})
