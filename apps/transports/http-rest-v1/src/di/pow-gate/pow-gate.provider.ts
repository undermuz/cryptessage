import { UnauthorizedHttpResponse } from "@inversifyjs/http-core"
import type { FastifyRequest } from "fastify"
import { inject, injectable } from "inversify"

import { ChallengeStore, type IChallengeStore } from "../challenge-store/types.js"
import { LocalHostRequest, type ILocalHostRequest } from "../local-host-request/types.js"
import { PowSession, type IPowSessionService } from "../pow-session/types.js"
import { PowVerification, type IPowVerification } from "../pow-verification/types.js"
import { ServerConfig, type ServerEnv } from "../server-config/types.js"
import type { IPowGate, PowGateSuccess } from "./types.js"

@injectable()
export class PowGateProvider implements IPowGate {
    constructor(
        @inject(ServerConfig) private readonly config: ServerEnv,
        @inject(ChallengeStore) private readonly challenges: IChallengeStore,
        @inject(PowVerification) private readonly pow: IPowVerification,
        @inject(LocalHostRequest) private readonly localHost: ILocalHostRequest,
        @inject(PowSession) private readonly sessions: IPowSessionService,
    ) {}

    public verifyForRequest(
        req: FastifyRequest,
        powHeader: string | undefined,
        sessionHeader: string | undefined,
    ): UnauthorizedHttpResponse | PowGateSuccess {
        const skipPowAllowed =
            this.config.skipPow && this.localHost.isLocalHost(req)

        if (skipPowAllowed) {
            return { kind: "skip" }
        }

        if (this.config.powMode === "always") {
            return this.verifyPowOnly(powHeader)
        }

        const proof = this.pow.parseHeader(powHeader)

        if (proof) {
            return this.verifyPowOnly(powHeader)
        }

        const sess = sessionHeader?.trim()

        if (sess) {
            const next = this.sessions.rotateAfterSessionAuth(sess)

            if (next) {
                return { kind: "session", sessionHeader: next }
            }

            return new UnauthorizedHttpResponse({ error: "session_invalid" })
        }

        return new UnauthorizedHttpResponse({ error: "pow_required" })
    }

    private verifyPowOnly(
        powHeader: string | undefined,
    ): UnauthorizedHttpResponse | PowGateSuccess {
        const proof = this.pow.parseHeader(powHeader)

        if (!proof) {
            return new UnauthorizedHttpResponse({ error: "pow_required" })
        }

        const stored = this.challenges.takeChallenge(proof.nonce)

        if (!stored) {
            return new UnauthorizedHttpResponse({
                error: "pow_challenge_invalid",
            })
        }

        if (
            !this.pow.verifyProof(
                proof,
                this.config.deploymentSecret,
                stored.difficultyBits,
            )
        ) {
            return new UnauthorizedHttpResponse({ error: "pow_invalid" })
        }

        return { kind: "pow" }
    }
}
