import { ContainerModule } from "inversify";

import { MyProvider, type IMyProvider } from "./types";

import { MyClass } from "./provider";

export const MyModule = new ContainerModule((ctx) => {
    ctx.bind<IMyProvider>(MyProvider).to(MyClass).inSingletonScope();
});
