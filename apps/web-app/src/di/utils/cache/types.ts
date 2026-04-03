import type { Initializable } from "../../types/initializable"

export const CacheProvider = Symbol.for("CacheProvider")

export const CacheConfigProvider = Symbol.for("CacheConfigProvider")

export const DEFAULT_CACHE_TTL = 1000 * 60 * 60 //1 hour

export type ICacheProvider = Initializable & {
    set: <T>(key: string, value: T, ttl?: number) => Promise<void>
    get: <T>(key: string) => Promise<T | undefined>
    delete: (key: string) => Promise<void>
}

export type ICacheConfig = {
    ttl: number
    prefix: string
}
