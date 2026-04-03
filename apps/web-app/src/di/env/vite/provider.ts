import { injectable } from "inversify"

import { type IEnvProvider } from "../types"

@injectable()
export class EnvVite implements IEnvProvider {
    public get<T extends string = string>(
        key: string,
        defaultValue?: T,
    ): T | undefined {
        return (import.meta.env[`VITE_${key}`] as T | undefined) ?? defaultValue
    }

    public getOrThrow<T extends string = string>(key: string): T {
        const value = this.get<T>(key)

        if (!value) {
            throw new Error(`Environment variable ${key} is not defined`)
        }

        return value
    }
}
