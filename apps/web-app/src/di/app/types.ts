import type { QueryClient } from "@tanstack/react-query"
import type { Initializable } from "@libs/di/types/initializable"
import type { AppConfig } from "../config/config.provider"

export const AppProvider = Symbol.for("AppProvider")

export type IAppProvider = Initializable & {
    queryClient: QueryClient
    config: AppConfig
}
