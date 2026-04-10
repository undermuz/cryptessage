import { UnauthorizedHttpResponse } from "@inversifyjs/http-core"
import type { FastifyRequest } from "fastify"
import { inject, injectable } from "inversify"

import { ChallengeStore, type IChallengeStore } from "../challenge-store/types.js"
import { LocalHostRequest, type ILocalHostRequest } from "../local-host-request/types.js"
import { PowVerification, type IPowVerification } from "../pow-verification/types.js"
import { ServerConfig, type ServerEnv } from "../server-config/types.js"
import type { IPowGate } from "./types.js"

@injectable()
export class PowGateProvider implements IPowGate {
    constructor(
        @inject(ServerConfig) private readonly config: ServerEnv,
        @inject(ChallengeStore) private readonly challenges: IChallengeStore,
        @inject(PowVerification) private readonly pow: IPowVerification,
        @inject(LocalHostRequest) private readonly localHost: ILocalHostRequest,
    ) {}

    public verifyForRequest(
        req: FastifyRequest,
        powHeader: string | undefined,
    ): UnauthorizedHttpResponse | null {
        const skipPowAllowed =
            this.config.skipPow && this.localHost.isLocalHost(req)

        if (skipPowAllowed) {
            return null
        }

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

        return null
    }
}
