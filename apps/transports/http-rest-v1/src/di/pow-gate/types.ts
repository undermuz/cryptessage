import type { UnauthorizedHttpResponse } from "@inversifyjs/http-core"
import type { FastifyRequest } from "fastify"

export const PowGate = Symbol.for("@cryptessage/http-rest-v1:PowGate")

export type IPowGate = {
    verifyForRequest(
        req: FastifyRequest,
        powHeader: string | undefined,
    ): UnauthorizedHttpResponse | null
}
