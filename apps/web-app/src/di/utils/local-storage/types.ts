import { Initializable } from "../../types/initializable"

export const LocalStorageProvider = Symbol.for("LocalStorageProvider")

export type ILocalStorage = Initializable<void, [{ prefix: string }]> & {
    getKeys: () => Promise<string[]>
    getItem: (key: string) => Promise<string | null>
    setItem: (key: string, value: string) => Promise<void>
    removeItem: (key: string) => Promise<void>
}
