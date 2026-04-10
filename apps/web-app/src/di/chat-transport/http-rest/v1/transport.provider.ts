import { inject, injectable } from "inversify"

import { HTTP_REST_V1_TRANSPORT_KIND } from "@/di/chat-transport/constants"
import {
    ChatTransportOutgoingStore,
    type IChatTransport,
    type IChatTransportOutgoingStore,
    type RecipientTransportMeta,
    type SenderTransportMeta,
    type Unsubscribe,
} from "@/di/chat-transport/types"
import { TimersProvider, type ITimersProvider } from "@/di/utils/timers/types"

import { extractDeploymentSecretFromBaseUrl } from "./deployment-secret"
import type { CreateHttpRestOutboxSubscription } from "./http-rest-outbox-subscription"
import { expandInboxPath } from "./http-rest-paths"
import { HttpRestPowHeadersProvider } from "./pow-headers.provider"
import type {
    HttpRestParsedConfig,
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
            const headers: Record<string, string> = {
                "Content-Type": "application/octet-stream",
            }

            if (cfg.bearerToken) {
                headers.Authorization = `Bearer ${cfg.bearerToken}`
            }

            Object.assign(
                headers,
                await this.powHeaders.buildPowHeaders(
                    cfg.baseUrl,
                    cfg.skipPow,
                    ac.signal,
                ),
            )

            const postRes = await fetch(url, {
                method: "POST",
                headers,
                body: payload as BufferSource,
                signal: ac.signal,
            })

            if (!postRes.ok) {
                throw new Error(`http_rest_v1: inbox HTTP ${postRes.status}`)
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

        if (!cfg.instanceId || !cfg.getOutboxCursor || !cfg.setOutboxCursor) {
            return () => {
                return
            }
        }

        const subscription = this.createHttpRestOutboxSubscription(
            cfg,
            selfKeyId,
            handler,
        )

        subscription.start()

        return subscription.asUnsubscribe()
    }
}
