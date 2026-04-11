import { Container } from "inversify"

import { ChallengeStoreModule } from "./challenge-store/module.js"
import { HttpRequestAuthModule } from "./http-request-auth/module.js"
import { IdempotencyStoreModule } from "./idempotency-store/module.js"
import { InboxModule } from "./inbox/module.js"
import { InMemoryModule } from "./in-memory/module.js"
import { LocalHostRequestModule } from "./local-host-request/module.js"
import { OutboxCursorModule } from "./outbox-cursor/module.js"
import { PowGateModule } from "./pow-gate/module.js"
import { PowSessionModule } from "./pow-session/module.js"
import { PowVerificationModule } from "./pow-verification/module.js"
import { createServerConfigModule } from "./server-config/module.js"
import type { ServerEnv } from "./server-config/types.js"

export function createHttpRestV1Container(config: ServerEnv): Container {
    const di = new Container({ defaultScope: "Singleton" })

    di.load(createServerConfigModule(config))
    di.load(InMemoryModule)
    di.load(ChallengeStoreModule)
    di.load(IdempotencyStoreModule)
    di.load(PowVerificationModule)
    di.load(OutboxCursorModule)
    di.load(LocalHostRequestModule)
    di.load(PowSessionModule)
    di.load(PowGateModule)
    di.load(HttpRequestAuthModule)
    di.load(InboxModule)

    return di
}
