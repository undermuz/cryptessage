import { ContainerModule } from "inversify"

import { EnvProvider, type IEnvProvider } from "../types"

import { EnvVite } from "./provider"

export const EnvViteModule = new ContainerModule((ctx) => {
    ctx.bind<IEnvProvider>(EnvProvider).to(EnvVite).inSingletonScope()
})
