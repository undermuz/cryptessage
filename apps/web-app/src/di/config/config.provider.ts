import { inject, injectable } from "inversify"

import { EnvProvider, type IEnvProvider } from "@/di/env/types"
import { LogLevels } from "@/di/logger/types"

import { type IConfigProvider } from "./types"
import {
    type ILocalStorage,
    LocalStorageProvider,
} from "@/di/utils/local-storage/types"

@injectable()
export class AppConfig implements IConfigProvider {
    @inject(EnvProvider)
    private readonly env: IEnvProvider

    @inject(LocalStorageProvider)
    private readonly localStorage: ILocalStorage

    public apiPrefix: string
    public logLevel: LogLevels

    public yandex: {
        geoSuggest: {
            apiKey: string
            endpoint: string
        }
        maps: {
            apiKey: string
        }
    }

    public gps: {
        type: string
    }

    public async get<T extends string = string>(
        key: string,
    ): Promise<T | undefined>
    public async get<T extends string = string>(
        key: string,
        defaultValue: T,
    ): Promise<T>
    public async get<T extends string = string>(
        key: string,
        defaultValue?: T,
    ): Promise<T | undefined> {
        const localValue = await this.localStorage.getItem(`config:v1:${key}`)

        if (localValue) {
            return localValue as T
        }

        const envValue = this.env.get<T>(key)

        if (envValue) {
            return envValue
        }

        return defaultValue
    }

    public async getOrThrow<T extends string = string>(
        key: string,
    ): Promise<T> {
        const value = await this.get<T>(key)

        if (!value) {
            throw new Error(`Config variable ${key} is not defined`)
        }

        return value
    }

    public async initialize() {
        this.apiPrefix = await this.getOrThrow("API_PREFIX")

        this.logLevel = await this.get<LogLevels>("LOG_LEVEL", "trace")

        this.yandex = {
            geoSuggest: {
                apiKey: await this.get("YANDEX_GEO_SUGGEST_KEY", ""),
                endpoint: await this.get(
                    "YANDEX_GEO_SUGGEST_ENDPOINT",
                    "https://suggest-maps.yandex.ru/v1/suggest",
                ),
            },
            maps: {
                apiKey: await this.get("YMAPS_API_KEY", ""),
            },
        }

        this.gps = {
            type: await this.get("GPS_TYPE", "browser"),
        }
    }
}
