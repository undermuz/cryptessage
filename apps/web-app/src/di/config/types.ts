import { LogLevels } from "@/di/logger/types"
import type { Initializable } from "@/di/types/initializable"

export const ConfigProvider = Symbol.for("ConfigProvider")

export type IConfigProvider = Initializable & {
    apiPrefix: string
    logLevel: LogLevels
    yandex: {
        geoSuggest: {
            apiKey: string
        }
        maps: {
            apiKey: string
        }
    }
    gps: {
        type: string
    }
}
