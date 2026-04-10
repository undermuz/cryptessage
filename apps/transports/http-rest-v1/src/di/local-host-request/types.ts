import type { FastifyRequest } from "fastify"

export const LocalHostRequest = Symbol.for(
    "@cryptessage/http-rest-v1:LocalHostRequest",
)

export type ILocalHostRequest = {
    isLocalHost(req: FastifyRequest): boolean
}
