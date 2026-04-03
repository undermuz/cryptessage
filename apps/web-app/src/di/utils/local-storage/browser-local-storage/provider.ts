import { injectable } from "inversify"
import { ILocalStorage } from "../types"

@injectable()
export class BrowserLocalStorageProvider implements ILocalStorage {
    protected prefix = "v1:"

    public async initialize(config: { prefix: string }): Promise<void> {
        this.prefix = config.prefix
    }

    public getLocalStorageKey(key: string): string {
        return `${this.prefix}${key}`
    }

    public async getItem(key: string): Promise<string | null> {
        return Promise.resolve(
            localStorage.getItem(this.getLocalStorageKey(key)),
        )
    }

    public async setItem(key: string, value: string): Promise<void> {
        return Promise.resolve(
            localStorage.setItem(this.getLocalStorageKey(key), value),
        )
    }

    public async removeItem(key: string): Promise<void> {
        return Promise.resolve(
            localStorage.removeItem(this.getLocalStorageKey(key)),
        )
    }

    public async getKeys(): Promise<string[]> {
        return Promise.resolve(
            Object.keys(localStorage)
                .filter((key) => key.startsWith(this.prefix))
                .map((key) => key.substring(this.prefix.length)),
        )
    }
}
