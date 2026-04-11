import { randomBytes } from "node:crypto"
import {
    AcceptedHttpResponse,
    BadRequestHttpResponse,
    Body,
    Controller,
    ErrorHttpResponse,
    Get,
    Headers,
    HttpStatusCode,
    OkHttpResponse,
    Params,
    Post,
    Query,
    Request,
    UnauthorizedHttpResponse,
} from "@inversifyjs/http-core"
import type { FastifyRequest } from "fastify"
import { inject } from "inversify"

import { ChallengeStore, type IChallengeStore } from "../challenge-store/types.js"
import { HttpRequestAuth, type IHttpRequestAuth } from "../http-request-auth/types.js"
import { IdempotencyStore, type IIdempotencyStore } from "../idempotency-store/types.js"
import { InMemoryService, type IInMemoryService } from "../in-memory/types.js"
import { OutboxCursor, type IOutboxCursor } from "../outbox-cursor/types.js"
import { PowGate, type IPowGate, type PowGateSuccess } from "../pow-gate/types.js"
import { PowSession, type IPowSessionService } from "../pow-session/types.js"
import { ServerConfig, type ServerEnv } from "../server-config/types.js"
import { IDEMPOTENCY_KEY_MAX_LEN } from "./types.js"

function toBase64Url(buf: Buffer): string {
    return buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

@Controller("/")
export class InboxController {
    constructor(
        @inject(ServerConfig) private readonly config: ServerEnv,
        @inject(InMemoryService) private readonly inbox: IInMemoryService,
        @inject(ChallengeStore) private readonly challenges: IChallengeStore,
        @inject(IdempotencyStore) private readonly idempotency: IIdempotencyStore,
        @inject(OutboxCursor) private readonly outboxCursor: IOutboxCursor,
        @inject(PowGate) private readonly powGate: IPowGate,
        @inject(PowSession) private readonly powSession: IPowSessionService,
        @inject(HttpRequestAuth) private readonly httpAuth: IHttpRequestAuth,
    ) {}

    private sessionHeadersFromGate(gate: PowGateSuccess): Record<string, string> {
        if (gate.kind === "skip") {
            return {}
        }

        if (this.config.powMode === "always") {
            return {}
        }

        if (gate.kind === "pow") {
            return {
                "X-Cryptessage-Session": this.powSession.issueAfterPow(),
            }
        }

        return { "X-Cryptessage-Session": gate.sessionHeader }
    }

    @Get("/:deploymentSecret/v1/challenge")
    challenge(
        @Params({ name: "deploymentSecret" }) deploymentSecret: string,
        @Request() req: FastifyRequest,
    ): {
        algorithm: "sha256-pow-v1"
        nonce: string
        difficultyBits: number
        expiresAt: string
        clientHints: {
            powMode: ServerEnv["powMode"]
            idleMsBeforePow: number
            maxRps: number
            maxRpm: number
        }
    } | UnauthorizedHttpResponse {
        if (
            !this.httpAuth.assertDeploymentSecret(
                deploymentSecret,
                this.config.deploymentSecret,
            )
        ) {
            return new UnauthorizedHttpResponse({ error: "invalid_deployment" })
        }

        if (!this.httpAuth.checkBearer(req, this.config.bearerToken)) {
            return new UnauthorizedHttpResponse({ error: "unauthorized" })
        }

        const nonceBytes = randomBytes(32)
        const nonce = toBase64Url(nonceBytes)
        const difficultyBits = this.config.difficultyBits
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

        this.challenges.rememberChallenge(nonce, difficultyBits, expiresAt)

        return {
            algorithm: "sha256-pow-v1",
            nonce,
            difficultyBits,
            expiresAt,
            clientHints: {
                powMode: this.config.powMode,
                idleMsBeforePow: this.config.powIdleMsBeforePow,
                maxRps: this.config.powMaxRps,
                maxRpm: this.config.powMaxRpm,
            },
        }
    }

    @Get("/:deploymentSecret/v1/outbox/:selfKeyId")
    getOutbox(
        @Params({ name: "deploymentSecret" }) deploymentSecret: string,
        @Params({ name: "selfKeyId" }) selfKeyId: string,
        @Query({ name: "since" }) since: string | undefined,
        @Headers({ name: "x-cryptessage-pow" }) powHeader: string | undefined,
        @Headers({ name: "x-cryptessage-session" }) sessionHeader:
            | string
            | undefined,
        @Request() req: FastifyRequest,
    ):
        | OkHttpResponse
        | UnauthorizedHttpResponse
        | BadRequestHttpResponse {
        if (
            !this.httpAuth.assertDeploymentSecret(
                deploymentSecret,
                this.config.deploymentSecret,
            )
        ) {
            return new UnauthorizedHttpResponse({ error: "invalid_deployment" })
        }

        if (!this.httpAuth.checkBearer(req, this.config.bearerToken)) {
            return new UnauthorizedHttpResponse({ error: "unauthorized" })
        }

        const gate = this.powGate.verifyForRequest(req, powHeader, sessionHeader)

        if (gate instanceof UnauthorizedHttpResponse) {
            return gate
        }

        if (!selfKeyId?.trim()) {
            return new BadRequestHttpResponse({ error: "invalid_self_key" })
        }

        const ownerId = selfKeyId.trim()
        const afterSeq = this.outboxCursor.decode(since)

        if (typeof afterSeq !== "number") {
            return afterSeq
        }

        const page = this.inbox.listOutboxAfter(
            ownerId,
            afterSeq,
            this.config.outboxPageSize,
        )

        const messages = page.messages.map((b) => b.toString("base64"))

        const nextCursor =
            page.lastSeqInPage !== null
                ? this.outboxCursor.encode(page.lastSeqInPage)
                : null

        const resHeaders: Record<string, string> = {
            "content-type": "application/json; charset=utf-8",
            ...this.sessionHeadersFromGate(gate),
        }

        return new OkHttpResponse({ nextCursor, messages }, resHeaders)
    }

    @Post("/:deploymentSecret/v1/inbox/:recipientKeyId")
    postInbox(
        @Params({ name: "deploymentSecret" }) deploymentSecret: string,
        @Params({ name: "recipientKeyId" }) recipientKeyId: string,
        @Headers({ name: "x-cryptessage-pow" }) powHeader: string | undefined,
        @Headers({ name: "x-cryptessage-session" }) sessionHeader:
            | string
            | undefined,
        @Headers({ name: "idempotency-key" }) idempotencyHeader: string | undefined,
        @Request() req: FastifyRequest,
        @Body() body: unknown,
    ):
        | AcceptedHttpResponse
        | UnauthorizedHttpResponse
        | BadRequestHttpResponse
        | ErrorHttpResponse {
        if (!recipientKeyId?.trim()) {
            return new BadRequestHttpResponse({ error: "invalid_recipient" })
        }

        if (
            !this.httpAuth.assertDeploymentSecret(
                deploymentSecret,
                this.config.deploymentSecret,
            )
        ) {
            return new UnauthorizedHttpResponse({ error: "invalid_deployment" })
        }

        if (!this.httpAuth.checkBearer(req, this.config.bearerToken)) {
            return new UnauthorizedHttpResponse({ error: "unauthorized" })
        }

        let idemKey: string | undefined

        if (idempotencyHeader !== undefined) {
            const trimmed = idempotencyHeader.trim()

            if (trimmed.length > IDEMPOTENCY_KEY_MAX_LEN) {
                return new BadRequestHttpResponse({
                    error: "idempotency_key_too_long",
                })
            }

            idemKey = trimmed.length > 0 ? trimmed : undefined
        }

        if (idemKey !== undefined && this.idempotency.hasKey(idemKey)) {
            return new AcceptedHttpResponse({ ok: true, deduplicated: true })
        }

        const gate = this.powGate.verifyForRequest(req, powHeader, sessionHeader)

        if (gate instanceof UnauthorizedHttpResponse) {
            return gate
        }

        const buf = normalizeBody(body)

        if (buf === null) {
            return new BadRequestHttpResponse({ error: "invalid_body" })
        }

        if (buf.byteLength > 1024 * 1024) {
            return new ErrorHttpResponse(
                HttpStatusCode.PAYLOAD_TOO_LARGE,
                { error: "payload_too_large" },
                "Payload Too Large",
                undefined,
                undefined,
            )
        }

        this.inbox.pushMessage(recipientKeyId.trim(), buf)

        if (idemKey !== undefined) {
            this.idempotency.rememberKey(idemKey)
        }

        const resHeaders = this.sessionHeadersFromGate(gate)

        return new AcceptedHttpResponse(
            { ok: true },
            Object.keys(resHeaders).length > 0 ? resHeaders : undefined,
        )
    }
}

function normalizeBody(body: unknown): Buffer | null {
    if (body === undefined || body === null) {
        return null
    }

    if (Buffer.isBuffer(body)) {
        return body
    }

    if (body instanceof Uint8Array) {
        return Buffer.from(body)
    }

    if (typeof body === "string") {
        return Buffer.from(body, "utf8")
    }

    return null
}
