import { inject, injectable } from "inversify"

import {
    type ILocalStorage,
    LocalStorageProvider,
} from "../local-storage/types"

import { type ICacheConfig, type ICacheProvider } from "./types"

@injectable()
export class CacheService implements ICacheProvider {
    private config: ICacheConfig

    @inject(LocalStorageProvider)
    private readonly localStorage: ILocalStorage

    private _cache: Map<string, unknown> = new Map()
    private _ttl: Map<string, number> = new Map()

    public async initialize(config: ICacheConfig) {
        this.config = config

        const keys = await this.localStorage.getKeys()

        for (const key of keys) {
            if (!key.startsWith(this.config.prefix)) {
                continue
            }

            const cacheKey = key.substring(this.config.prefix.length)

            const item = await this.localStorage.getItem(key)

            if (!item) {
                continue
            }

            try {
                const { value, expiresAt } = JSON.parse(item)

                if (Date.now() >= expiresAt) {
                    throw new Error("Cache item expired")
                }

                this._cache.set(cacheKey, value)
                this._ttl.set(cacheKey, expiresAt)
            } catch {
                await this.delete(cacheKey)
            }
        }
    }

    private getLocalStorageKey(key: string): string {
        return `${this.config.prefix}${key}`
    }

    private async saveToLocalStorage(
        key: string,
        value: unknown,
        expiresAt: number,
    ) {
        await this.localStorage.setItem(
            this.getLocalStorageKey(key),
            JSON.stringify({ value, expiresAt }),
        )
    }

    public async set<T>(
        key: string,
        value: T,
        ttl: number = this.config.ttl,
    ): Promise<void> {
        const expiresAt = Date.now() + ttl

        this._cache.set(key, value)
        this._ttl.set(key, expiresAt)

        await this.saveToLocalStorage(key, value, expiresAt)
    }

    private async ensureValid(key: string): Promise<boolean> {
        const ttl = this._ttl.get(key)

        if (ttl === undefined) {
            await this.delete(key)

            return false
        }

        if (Date.now() > ttl) {
            await this.delete(key)

            return false
        }

        return true
    }

    public async get<T>(key: string): Promise<T | undefined> {
        if (!(await this.ensureValid(key))) {
            return undefined
        }

        const value = this._cache.get(key) as T | undefined

        return value
    }

    public async has(key: string): Promise<boolean> {
        if (!(await this.ensureValid(key))) {
            return false
        }

        return this._cache.has(key)
    }

    public async delete(key: string): Promise<void> {
        this._cache.delete(key)
        this._ttl.delete(key)

        await this.localStorage.removeItem(this.getLocalStorageKey(key))
    }

    public async clear(): Promise<void> {
        const keys = Array.from(this._cache.keys())

        for (const key of keys) {
            await this.delete(key)
        }
    }
}
