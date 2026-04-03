import { ContainerModule } from "inversify"

import { AuthProvider } from "./auth.provider"
import { AuthService, type IAuthService } from "./types"

export const AuthModule = new ContainerModule((ctx) => {
    ctx.bind<IAuthService>(AuthService).to(AuthProvider).inSingletonScope()
})
