import type { FastifyRequest } from "fastify"

export const HttpRequestAuth = Symbol.for(
    "@cryptessage/http-rest-v1:HttpRequestAuth",
)

export type IHttpRequestAuth = {
    assertDeploymentSecret(pathSecret: string, expected: string): boolean
    checkBearer(
        req: FastifyRequest,
        expectedToken: string | undefined,
    ): boolean
}
