export const ServerConfig = Symbol.for("@cryptessage/http-rest-v1:ServerConfig")

/** `true` = allow any browser origin (reflect `Origin`, same as `@fastify/cors` `origin: true`). */
export type CorsOriginSetting = boolean | string | string[]

export type ServerEnv = {
    port: number
    deploymentSecret: string
    bearerToken: string | undefined
    difficultyBits: number
    skipPow: boolean
    outboxPageSize: number
    corsOrigin: CorsOriginSetting
}
