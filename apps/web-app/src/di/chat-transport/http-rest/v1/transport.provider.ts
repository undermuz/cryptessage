import { inject, injectable } from "inversify"

import { HTTP_REST_V1_TRANSPORT_KIND } from "@/di/chat-transport/constants"
import {
    ChatTransportOutgoingStore,
    type IChatTransport,
    type IChatTransportOutgoingStore,
    type ITransportPrefsService,
    type RecipientTransportMeta,
    type SenderTransportMeta,
    TransportPrefsService,
    type Unsubscribe,
} from "@/di/chat-transport/types"
import { TimersProvider, type ITimersProvider } from "@/di/utils/timers/types"

import { extractDeploymentSecretFromBaseUrl } from "./deployment-secret"
import type { CreateHttpRestOutboxSubscription } from "./http-rest-outbox-subscription"
import { expandInboxPath } from "./http-rest-paths"
import { HTTP_REST_V1_STORE_EPOCH_HEADER } from "./http-rest-store-epoch"
import { readUnauthorizedErrorCode } from "./pow-http-errors"
import { HttpRestPowHeadersProvider } from "./pow-headers.provider"
import type {
    HttpRestParsedConfig,
    HttpRestPowMode,
    HttpRestSubscribeRuntimeConfig,
} from "./types"

/** True if `baseUrl` host looks like local/dev (used to gate `skipPow`). */
function isLocalDevHost(baseUrl: string): boolean {
    try {
        const { hostname } = new URL(baseUrl)

        return (
            hostname === "localhost" ||
            hostname === "[::1]" ||
            hostname.startsWith("127.") ||
            hostname.startsWith("192.168.")
        )
    } catch {
        return false
    }
}

/**
 * `http_rest_v1` transport: POST ciphertext to per-recipient inbox, optionally poll outbox for inbound blobs.
 * Implements {@link IChatTransport}.
 */
@injectable()
export class HttpRestTransportProvider implements IChatTransport {
    /** Transport kind string (`http_rest_v1`). */
    public readonly kind = HTTP_REST_V1_TRANSPORT_KIND

    /**
     * Capabilities: no server push; send is automatic once recipient inbox id is set; outbox polling via `subscribe`.
     */
    public readonly capabilities = {
        supportsPush: false,
        requiresUserActionForSend: false,
        supportsSubscribe: true,
    } as const

    /** Used to record last HTTP status after a successful inbox POST (for UI / diagnostics). */
    @inject(ChatTransportOutgoingStore)
    private readonly outgoing!: IChatTransportOutgoingStore

    @inject(TimersProvider)
    private readonly timers!: ITimersProvider<string>

    @inject(HttpRestPowHeadersProvider)
    private readonly powHeaders!: HttpRestPowHeadersProvider

    @inject(TransportPrefsService)
    private readonly transportPrefs!: ITransportPrefsService

    @inject("Factory<HttpRestOutboxSubscription>")
    private readonly createHttpRestOutboxSubscription!: CreateHttpRestOutboxSubscription

    /**
     * Validates and normalizes persisted profile `config` JSON into {@link HttpRestParsedConfig}.
     * @throws If shape is invalid, `skipPow` is used on non-local hosts, or required fields are missing.
     */
    public parseConfig(raw: unknown): HttpRestParsedConfig {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            throw new Error("http_rest_v1: config must be an object")
        }

        const o = raw as Record<string, unknown>

        if (typeof o.baseUrl !== "string" || !o.baseUrl.trim()) {
            throw new Error("http_rest_v1: baseUrl is required")
        }

        const baseUrl = o.baseUrl.trim().replace(/\/$/, "")
        const skipPow = o.skipPow === true

        if (skipPow && !isLocalDevHost(baseUrl)) {
            throw new Error(
                "http_rest_v1: skipPow is only allowed for localhost baseUrl",
            )
        }

        const inboxPathTemplate =
            typeof o.inboxPathTemplate === "string" &&
            o.inboxPathTemplate.length > 0
                ? o.inboxPathTemplate
                : "/inbox/{recipientKeyId}"

        const outboxPathTemplate =
            typeof o.outboxPathTemplate === "string" &&
            o.outboxPathTemplate.length > 0
                ? o.outboxPathTemplate
                : "/outbox/{selfKeyId}"

        let outboxSelfKeyId: string | undefined

        if (typeof o.outboxSelfKeyId === "string" && o.outboxSelfKeyId.trim()) {
            outboxSelfKeyId = o.outboxSelfKeyId.trim()
        }

        const pollRaw =
            typeof o.pollIntervalMs === "number" &&
            Number.isFinite(o.pollIntervalMs)
                ? o.pollIntervalMs
                : 10_000

        const pollIntervalMs = Math.min(
            60_000,
            Math.max(1000, Math.floor(pollRaw)),
        )

        const timeoutMs =
            typeof o.timeoutMs === "number" &&
            Number.isFinite(o.timeoutMs) &&
            o.timeoutMs > 0
                ? Math.min(o.timeoutMs, 120_000)
                : 15_000

        const enablePoll = o.enablePoll !== false

        let powMode: HttpRestPowMode | undefined

        if (o.powMode !== undefined) {
            if (o.powMode !== "adaptive" && o.powMode !== "always") {
                throw new Error(
                    'http_rest_v1: powMode must be "adaptive" or "always"',
                )
            }

            powMode = o.powMode
        }

        let powIdleMsBeforePow: number | undefined

        if (o.powIdleMsBeforePow !== undefined) {
            if (
                typeof o.powIdleMsBeforePow !== "number" ||
                !Number.isFinite(o.powIdleMsBeforePow) ||
                o.powIdleMsBeforePow < 1000
            ) {
                throw new Error(
                    "http_rest_v1: powIdleMsBeforePow must be a number ≥ 1000",
                )
            }

            powIdleMsBeforePow = Math.floor(o.powIdleMsBeforePow)
        }

        let powMaxRps: number | undefined

        if (o.powMaxRps !== undefined) {
            if (
                typeof o.powMaxRps !== "number" ||
                !Number.isFinite(o.powMaxRps) ||
                o.powMaxRps < 1
            ) {
                throw new Error("http_rest_v1: powMaxRps must be an integer ≥ 1")
            }

            powMaxRps = Math.floor(o.powMaxRps)
        }

        let powMaxRpm: number | undefined

        if (o.powMaxRpm !== undefined) {
            if (
                typeof o.powMaxRpm !== "number" ||
                !Number.isFinite(o.powMaxRpm) ||
                o.powMaxRpm < 1
            ) {
                throw new Error("http_rest_v1: powMaxRpm must be an integer ≥ 1")
            }

            powMaxRpm = Math.floor(o.powMaxRpm)
        }

        return {
            baseUrl,
            bearerToken:
                typeof o.bearerToken === "string" && o.bearerToken.length > 0
                    ? o.bearerToken
                    : undefined,
            inboxPathTemplate,
            outboxSelfKeyId,
            outboxPathTemplate,
            pollIntervalMs,
            timeoutMs,
            skipPow,
            enablePoll,
            powMode,
            powIdleMsBeforePow,
            powMaxRps,
            powMaxRpm,
        }
    }

    /**
     * POST `payload` to `…/inbox/{recipientKeyId}` derived from `meta.httpRestInboxRecipientKeyId`.
     * On HTTP success, updates {@link IChatTransportOutgoingStore.setLastNetworkDelivery}.
     * @throws If inbox id missing, URL invalid, challenge/PoW fails, or POST is non-OK.
     */
    public async send(
        payload: Uint8Array,
        meta: RecipientTransportMeta,
        instanceConfig: unknown,
    ): Promise<void> {
        const cfg = instanceConfig as HttpRestParsedConfig
        const recipientKeyId = meta.httpRestInboxRecipientKeyId?.trim()

        if (!recipientKeyId) {
            throw new Error(
                "http_rest_v1: contact has no httpRestInboxRecipientKeyId (inbox id)",
            )
        }

        extractDeploymentSecretFromBaseUrl(cfg.baseUrl)

        const path = expandInboxPath(cfg.inboxPathTemplate, recipientKeyId)
        const url = `${cfg.baseUrl}${path.startsWith("/") ? path : `/${path}`}`
        const ac = new AbortController()
        const timeoutId = this.timers.timeout(() => {
            ac.abort()
        }, cfg.timeoutMs)

        try {
            const postOnce = async () => {
                const headers: Record<string, string> = {
                    "Content-Type": "application/octet-stream",
                }

                if (cfg.bearerToken) {
                    headers.Authorization = `Bearer ${cfg.bearerToken}`
                }

                Object.assign(
                    headers,
                    await this.powHeaders.buildPowHeaders(cfg, ac.signal),
                )

                return fetch(url, {
                    method: "POST",
                    headers,
                    body: payload as BufferSource,
                    signal: ac.signal,
                })
            }

            let postRes = await postOnce()

            if (postRes.status === 401 && !cfg.skipPow) {
                const code = await readUnauthorizedErrorCode(postRes)

                if (
                    code === "pow_required" ||
                    code === "session_invalid" ||
                    code === "pow_challenge_invalid" ||
                    code === "pow_invalid"
                ) {
                    this.powHeaders.onAuthFailure(cfg)
                    postRes = await postOnce()
                }
            }

            if (!postRes.ok) {
                throw new Error(`http_rest_v1: inbox HTTP ${postRes.status}`)
            }

            this.powHeaders.onSuccessfulResponse(cfg, postRes)

            const epochH = postRes.headers.get(HTTP_REST_V1_STORE_EPOCH_HEADER)

            if (epochH?.trim()) {
                const baseNorm = cfg.baseUrl.trim().replace(/\/$/, "")
                const prefs = await this.transportPrefs.load()

                for (const p of prefs.profiles) {
                    if (
                        p.kind !== HTTP_REST_V1_TRANSPORT_KIND ||
                        !p.enabled
                    ) {
                        continue
                    }

                    let parsed: HttpRestParsedConfig

                    try {
                        parsed = this.parseConfig(
                            p.config,
                        ) as HttpRestParsedConfig
                    } catch {
                        continue
                    }

                    if (
                        parsed.baseUrl.trim().replace(/\/$/, "") !== baseNorm
                    ) {
                        continue
                    }

                    await this.transportPrefs.applyHttpRestStoreEpochFromHeader(
                        p.instanceId,
                        epochH,
                    )
                }
            }

            this.outgoing.setLastNetworkDelivery({
                kind: HTTP_REST_V1_TRANSPORT_KIND,
                status: postRes.status,
            })
        } finally {
            this.timers.clearTimeout(timeoutId)
        }
    }

    /**
     * Polls the configured outbox for base64 messages, decodes each to bytes and calls `handler`.
     * Uses {@link HttpRestOutboxSubscription} for interval + in-flight poll state.
     * Returns a no-op unsubscribe if `outboxSelfKeyId` or cursor hooks are missing.
     */
    public subscribe(
        handler: (data: Uint8Array, meta: SenderTransportMeta) => void,
        instanceConfig: unknown,
    ): Unsubscribe {
        const cfg = instanceConfig as HttpRestSubscribeRuntimeConfig
        const selfKeyId = cfg.outboxSelfKeyId?.trim()

        if (!selfKeyId) {
            return () => {
                return
            }
        }

        if (
            !cfg.instanceId ||
            !cfg.getOutboxCursor ||
            !cfg.setOutboxCursor ||
            !cfg.reconcileStoreEpoch
        ) {
            return () => {
                return
            }
        }

        const subscription = this.createHttpRestOutboxSubscription(
            cfg,
            selfKeyId,
            handler,
        )

        if (cfg.enablePoll) {
            subscription.start()
        }

        return subscription.asUnsubscribe()
    }
}
