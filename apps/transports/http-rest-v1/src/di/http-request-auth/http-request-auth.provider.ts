import type { FastifyRequest } from "fastify"
import { injectable } from "inversify"

import type { IHttpRequestAuth } from "./types.js"

@injectable()
export class HttpRequestAuthProvider implements IHttpRequestAuth {
    public assertDeploymentSecret(pathSecret: string, expected: string): boolean {
        return pathSecret === expected
    }

    public checkBearer(
        req: FastifyRequest,
        expectedToken: string | undefined,
    ): boolean {
        if (expectedToken === undefined) {
            return true
        }

        const auth = req.headers.authorization

        if (typeof auth !== "string" || !auth.startsWith("Bearer ")) {
            return false
        }

        const token = auth.slice("Bearer ".length).trim()

        return token === expectedToken
    }
}
