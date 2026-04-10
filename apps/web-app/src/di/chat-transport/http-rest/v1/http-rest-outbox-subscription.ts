import { inject, injectable } from "inversify"

import { HTTP_REST_V1_TRANSPORT_KIND } from "@/di/chat-transport/constants"
import type {
    SenderTransportMeta,
    Unsubscribe,
} from "@/di/chat-transport/types"
import type { ILoggerFactory } from "@/di/logger/types"
import type { ILogger } from "@/di/types/logger"
import { base64ToBytes } from "@/di/secure/encoding"
import {
    PromiseManagerProvider,
    type PromiseManager,
} from "@/di/utils/promise-manager/types"
import { TimersProvider, type ITimersProvider } from "@/di/utils/timers/types"

import { extractDeploymentSecretFromBaseUrl } from "./deployment-secret"
import { expandOutboxPath } from "./http-rest-paths"
import { HttpRestPowHeadersProvider } from "./pow-headers.provider"
import type {
    HttpRestSubscribeRuntimeConfig,
    OutboxJsonResponse,
} from "./types"

/** Injected as `"Factory<HttpRestOutboxSubscription>"` via {@link HttpRestV1TransportModule}. */
export type CreateHttpRestOutboxSubscription = (
    cfg: HttpRestSubscribeRuntimeConfig,
    selfKeyId: string,
    handler: (data: Uint8Array, meta: SenderTransportMeta) => void,
) => HttpRestOutboxSubscription

/**
 * One active outbox poll + interval for a single `http_rest_v1` profile (`instanceId`).
 * Resolve with **transient** scope; call {@link HttpRestOutboxSubscription.initialize} before {@link HttpRestOutboxSubscription.start}
 * (the module factory does this).
 */
@injectable()
export class HttpRestOutboxSubscription {
    private readonly log: ILogger

    @inject(TimersProvider)
    private readonly timers!: ITimersProvider<string>

    @inject(PromiseManagerProvider)
    private readonly promiseManager!: PromiseManager

    @inject(HttpRestPowHeadersProvider)
    private readonly powHeaders!: HttpRestPowHeadersProvider

    private cfg!: HttpRestSubscribeRuntimeConfig
    private selfKeyId!: string
    private handler!: (data: Uint8Array, meta: SenderTransportMeta) => void

    private intervalName!: string
    private pollKey!: string

    private stopped = false
    private cycle = 0

    constructor(@inject("Factory<Logger>") loggerFactory: ILoggerFactory) {
        this.log = loggerFactory("HttpRestOutboxSubscription")
    }

    /**
     * Binds runtime subscribe arguments; required before {@link HttpRestOutboxSubscription.start}.
     * Called by the container `Factory<HttpRestOutboxSubscription>` wrapper.
     */
    public initialize(
        cfg: HttpRestSubscribeRuntimeConfig,
        selfKeyId: string,
        handler: (data: Uint8Array, meta: SenderTransportMeta) => void,
    ): this {
        this.cfg = cfg
        this.selfKeyId = selfKeyId
        this.handler = handler
        this.intervalName = `http-rest:outbox:${cfg.instanceId}`
        this.pollKey = `http-rest:outbox-poll:${cfg.instanceId}`

        return this
    }

    /** Starts periodic kicks (first kick may run on a microtask via timers). */
    public start(): void {
        this.log.debug(
            "Outbox subscribe: instanceId={instanceId} pollIntervalMs={pollIntervalMs}",
            {
                instanceId: this.cfg.instanceId,
                pollIntervalMs: this.cfg.pollIntervalMs,
            },
        )

        this.timers.interval(this.intervalName, () => this.kick(), {
            interval: this.cfg.pollIntervalMs,
            immediate: true,
        })
    }

    /** Tears down interval, aborts in-flight poll, invalidates running cycles. */
    public dispose(): void {
        this.stopped = true
        this.cycle += 1
        this.promiseManager.abort(this.pollKey)
        this.timers.clearInterval(this.intervalName)
        this.log.debug("Outbox unsubscribe: {instanceId}", {
            instanceId: this.cfg.instanceId,
        })
    }

    /** @returns Unsubscribe callback for {@link IChatTransport.subscribe}. */
    public asUnsubscribe(): Unsubscribe {
        return () => {
            this.dispose()
        }
    }

    private kick(): void {
        if (this.stopped) {
            return
        }

        if (this.promiseManager.getStatus(this.pollKey) === "pending") {
            return
        }

        this.cycle += 1

        const c = this.cycle

        this.promiseManager.create(this.pollKey, (signal) =>
            this.runPoll(c, signal),
        )
    }

    private isPollFresh(myCycle: number, pollSignal: AbortSignal): boolean {
        return !this.stopped && myCycle === this.cycle && !pollSignal.aborted
    }

    private resolveOutboxBasePath(): string {
        const path = expandOutboxPath(
            this.cfg.outboxPathTemplate,
            this.selfKeyId,
        )

        return path.startsWith("/") ? path : `/${path}`
    }

    private async buildOutboxFetchHeaders(
        fetchSignal: AbortSignal,
    ): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            Accept: "application/json",
        }

        if (this.cfg.bearerToken) {
            headers.Authorization = `Bearer ${this.cfg.bearerToken}`
        }

        Object.assign(
            headers,
            await this.powHeaders.buildPowHeaders(
                this.cfg.baseUrl,
                this.cfg.skipPow,
                fetchSignal,
            ),
        )

        return headers
    }

    /** One GET outbox request with per-request timeout and {@link pollSignal} forwarding. */
    private async fetchOutboxPageJson(
        sinceParam: string,
        basePath: string,
        pollSignal: AbortSignal,
    ): Promise<OutboxJsonResponse> {
        const ac = new AbortController()
        let timeoutId: string | undefined

        try {
            timeoutId = this.timers.timeout(() => {
                ac.abort()
            }, this.cfg.timeoutMs)

            const onPollAbort = () => {
                ac.abort()
            }

            pollSignal.addEventListener("abort", onPollAbort)

            try {
                const headers = await this.buildOutboxFetchHeaders(ac.signal)
                const q =
                    sinceParam.length > 0
                        ? `?since=${encodeURIComponent(sinceParam)}`
                        : ""
                const url = `${this.cfg.baseUrl}${basePath}${q}`
                const res = await fetch(url, {
                    method: "GET",
                    headers,
                    signal: ac.signal,
                })

                if (!res.ok) {
                    throw new Error(`http_rest_v1: outbox HTTP ${res.status}`)
                }

                return (await res.json()) as OutboxJsonResponse
            } finally {
                pollSignal.removeEventListener("abort", onPollAbort)
            }
        } finally {
            if (timeoutId !== undefined) {
                this.timers.clearTimeout(timeoutId)
            }
        }
    }

    /**
     * Decodes base64 items and invokes the subscribe handler.
     * @returns `true` if the poll should stop (stale cycle / aborted).
     */
    private deliverOutboxMessageBatch(
        rawList: unknown,
        myCycle: number,
        pollSignal: AbortSignal,
    ): boolean {
        if (!Array.isArray(rawList)) {
            throw new Error("http_rest_v1: outbox invalid messages")
        }

        for (const item of rawList) {
            if (!this.isPollFresh(myCycle, pollSignal)) {
                return true
            }

            if (typeof item !== "string" || !item.trim()) {
                continue
            }

            let bytes: Uint8Array

            try {
                bytes = base64ToBytes(item.trim())
            } catch {
                continue
            }

            if (bytes.byteLength === 0) {
                continue
            }

            this.handler(bytes, {
                transportKind: HTTP_REST_V1_TRANSPORT_KIND,
                transportInstanceId: this.cfg.instanceId,
            })
        }

        return !this.isPollFresh(myCycle, pollSignal)
    }

    /**
     * Persists cursor for the next page or final `since`; returns whether to keep paging.
     */
    private async applyOutboxCursorStep(
        json: OutboxJsonResponse,
        sinceParam: string,
    ): Promise<{ nextSince: string; continuePaging: boolean }> {
        const next = json.nextCursor

        if (typeof next === "string" && next.length > 0) {
            await this.cfg.setOutboxCursor(next)

            return { nextSince: next, continuePaging: true }
        }

        if (sinceParam.length > 0) {
            await this.cfg.setOutboxCursor(sinceParam)
        }

        return { nextSince: sinceParam, continuePaging: false }
    }

    private async runPoll(
        myCycle: number,
        pollSignal: AbortSignal,
    ): Promise<void> {
        if (!this.isPollFresh(myCycle, pollSignal)) {
            return
        }

        try {
            extractDeploymentSecretFromBaseUrl(this.cfg.baseUrl)

            const basePath = this.resolveOutboxBasePath()
            let sinceParam = (await this.cfg.getOutboxCursor()) ?? ""

            while (this.isPollFresh(myCycle, pollSignal)) {
                const json = await this.fetchOutboxPageJson(
                    sinceParam,
                    basePath,
                    pollSignal,
                )

                if (!this.isPollFresh(myCycle, pollSignal)) {
                    return
                }

                if (
                    this.deliverOutboxMessageBatch(
                        json.messages,
                        myCycle,
                        pollSignal,
                    )
                ) {
                    return
                }

                if (!this.isPollFresh(myCycle, pollSignal)) {
                    return
                }

                const { nextSince, continuePaging } =
                    await this.applyOutboxCursorStep(json, sinceParam)

                sinceParam = nextSince

                if (!continuePaging) {
                    break
                }
            }
        } catch (e) {
            if (!this.stopped && !pollSignal.aborted) {
                this.log.warn("Outbox poll failed: {error}", { error: e })
            }
        }
    }
}
