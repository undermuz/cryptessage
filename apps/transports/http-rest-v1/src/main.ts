import { loadServerEnv } from "./di/server-config/server-config.provider.js"
import { buildHttpRestV1Server } from "./server.js"

const config = loadServerEnv()
const app = await buildHttpRestV1Server(config, { logger: true })

await app.listen({ port: config.port, host: "0.0.0.0" })

console.error(
    `[http-rest-v1] listening on :${config.port}; deployment path segment: ${config.deploymentSecret.slice(0, 8)}…`,
)
