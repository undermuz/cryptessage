import type { UnauthorizedHttpResponse } from "@inversifyjs/http-core"
import type { FastifyRequest } from "fastify"

export const PowGate = Symbol.for("@cryptessage/http-rest-v1:PowGate")

export type PowGateSuccess =
    | { kind: "skip" }
    | { kind: "pow" }
    | { kind: "session"; sessionHeader: string }

export type IPowGate = {
    verifyForRequest(
        req: FastifyRequest,
        powHeader: string | undefined,
        sessionHeader: string | undefined,
    ): UnauthorizedHttpResponse | PowGateSuccess
}
