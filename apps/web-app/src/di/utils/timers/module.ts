import { ContainerModule } from "inversify"

import { TimersProvider, type ITimersProvider } from "./types"

import { TimersClass } from "./provider"

export const TimersModule = new ContainerModule((ctx) => {
    // `TimersClass` is generic (`TimersClass<T = string>`). Inversify's `to(...)`
    // expects a non-generic `Newable<ITimersProvider<...>>`, so we explicitly
    // bind the `string` variant to match `ITimersProvider<string>`.
    ctx.bind<ITimersProvider<string>>(TimersProvider)
        .to(TimersClass as unknown as new () => ITimersProvider<string>)
        .inSingletonScope()
})
