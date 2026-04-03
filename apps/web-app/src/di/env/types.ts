export interface IEnvProvider {
    get<T extends string = string>(key: string): T | undefined
    get<T extends string = string>(key: string, defaultValue: T): T
    getOrThrow<T extends string = string>(key: string): T
}

export const EnvProvider = Symbol.for("EnvProvider")
