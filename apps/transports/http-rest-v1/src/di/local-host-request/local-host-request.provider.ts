import type { FastifyRequest } from "fastify"
import { injectable } from "inversify"

import type { ILocalHostRequest } from "./types.js"

@injectable()
export class LocalHostRequestProvider implements ILocalHostRequest {
    public isLocalHost(req: FastifyRequest): boolean {
        const host = req.hostname?.toLowerCase() ?? ""

        if (
            host === "localhost" ||
            host === "127.0.0.1" ||
            host === "[::1]" ||
            host === "::1" ||
            host.startsWith("127.") ||
            host.startsWith("192.168.")
        ) {
            return true
        }

        const rawIp = req.ip

        if (
            rawIp === "127.0.0.1" ||
            rawIp === "::1" ||
            rawIp === "::ffff:127.0.0.1" ||
            rawIp?.startsWith("127.") ||
            rawIp?.startsWith("192.168.")
        ) {
            return true
        }

        return false
    }
}
