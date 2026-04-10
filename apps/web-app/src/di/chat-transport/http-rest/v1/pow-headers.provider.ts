import { injectable } from "inversify"

import { extractDeploymentSecretFromBaseUrl } from "./deployment-secret"
import { buildPowProofFromChallenge, solveSha256PowV1 } from "./pow-sha256-pow"
import type { PowChallenge } from "./types"

/** Challenge fetch + PoW header builder shared by inbox POST and outbox GET. */
export type IHttpRestPowHeadersService = {
    buildPowHeaders(
        baseUrl: string,
        skipPow: boolean,
        signal: AbortSignal,
    ): Promise<Record<string, string>>
}

@injectable()
export class HttpRestPowHeadersProvider implements IHttpRestPowHeadersService {
    /**
     * Fetches `/challenge`, solves PoW when needed, returns headers including `X-Cryptessage-Pow`.
     */
    public async buildPowHeaders(
        baseUrl: string,
        skipPow: boolean,
        signal: AbortSignal,
    ): Promise<Record<string, string>> {
        const headers: Record<string, string> = {}

        if (skipPow) {
            return headers
        }

        const depSecret = extractDeploymentSecretFromBaseUrl(baseUrl)
        const chRes = await fetch(`${baseUrl}/challenge`, {
            method: "GET",
            signal,
        })

        if (!chRes.ok) {
            throw new Error(`http_rest_v1: challenge HTTP ${chRes.status}`)
        }

        const challenge = (await chRes.json()) as PowChallenge
        const expires = Date.parse(challenge.expiresAt)

        if (Number.isFinite(expires) && Date.now() > expires) {
            throw new Error("http_rest_v1: challenge expired")
        }

        const { counter } = await solveSha256PowV1(challenge, depSecret)

        headers["X-Cryptessage-Pow"] = buildPowProofFromChallenge(
            challenge,
            counter,
        )

        return headers
    }
}
