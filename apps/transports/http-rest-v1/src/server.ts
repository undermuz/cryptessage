import "reflect-metadata"

import cors from "@fastify/cors"
import { InversifyFastifyHttpAdapter } from "@inversifyjs/http-fastify"
import fastify, { type FastifyInstance } from "fastify"

import type { ServerEnv } from "./di/server-config/types.js"
import { createHttpRestV1Container } from "./di/container.js"

export async function buildHttpRestV1Server(
    config: ServerEnv,
    opts?: { logger?: boolean },
): Promise<FastifyInstance> {
    const container = createHttpRestV1Container(config)

    const app = fastify({
        bodyLimit: 1024 * 1024,
        logger: opts?.logger ?? true,
    })

    await app.register(cors, {
        origin: config.corsOrigin,
        methods: ["GET", "POST", "OPTIONS", "HEAD"],
        allowedHeaders: [
            "Authorization",
            "Content-Type",
            "X-Cryptessage-Pow",
            "X-Cryptessage-Session",
            "Idempotency-Key",
        ],
        exposedHeaders: [
            "X-Cryptessage-Session",
            "X-Cryptessage-Store-Epoch",
        ],
    })

    app.addContentTypeParser(
        "application/octet-stream",
        { parseAs: "buffer" },
        (_req, body, done) => {
            done(null, body)
        },
    )

    const adapter = new InversifyFastifyHttpAdapter(
        container,
        {
            logger: true,
            useMultipartFormData: false,
        },
        app,
    )

    await adapter.build()

    return app
}

