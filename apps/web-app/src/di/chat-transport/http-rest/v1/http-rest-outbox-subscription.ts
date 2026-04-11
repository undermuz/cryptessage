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
import { HTTP_REST_V1_STORE_EPOCH_HEADER } from "./http-rest-store-epoch"
import { readUnauthorizedErrorCode } from "./pow-http-errors"
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

    /** Serialized one-shot polls (manual refresh / overlap safety). */
    private pollOnceChain = Promise.resolve()

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

    /**
     * Runs a single outbox poll (all pages until the server stops paging), without starting
     * the interval timer. Used when `enablePoll` is false.
     */
    public pollOnce(): Promise<void> {
        this.log.debug("Outbox pollOnce: instanceId={instanceId}", {
            instanceId: this.cfg.instanceId,
        })

        this.pollOnceChain = this.pollOnceChain.then(() => this.pollOnceInner())

        return this.pollOnceChain
    }

    private async pollOnceInner(): Promise<void> {
        if (this.stopped) {
            this.log.trace("Outbox pollOnce skipped: stopped instanceId={instanceId}", {
                instanceId: this.cfg.instanceId,
            })

            return
        }

        this.cycle += 1

        const c = this.cycle
        const ac = new AbortController()

        try {
            await this.runPoll(c, ac.signal)
        } finally {
            ac.abort()
        }
    }

    private kick(): void {
        if (this.stopped) {
            this.log.trace("Outbox kick skipped: stopped instanceId={instanceId}", {
                instanceId: this.cfg.instanceId,
            })

            return
        }

        if (this.promiseManager.getStatus(this.pollKey) === "pending") {
            this.log.trace(
                "Outbox kick skipped: poll already in flight instanceId={instanceId}",
                { instanceId: this.cfg.instanceId },
            )

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
            await this.powHeaders.buildPowHeaders(this.cfg, fetchSignal),
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
                const q =
                    sinceParam.length > 0
                        ? `?since=${encodeURIComponent(sinceParam)}`
                        : ""
                const url = `${this.cfg.baseUrl}${basePath}${q}`

                const fetchOnce = async () => {
                    const headers = await this.buildOutboxFetchHeaders(ac.signal)

                    return fetch(url, {
                        method: "GET",
                        headers,
                        signal: ac.signal,
                    })
                }

                let res = await fetchOnce()

                if (res.status === 401 && !this.cfg.skipPow) {
                    const code = await readUnauthorizedErrorCode(res)

                    if (
                        code === "pow_required" ||
                        code === "session_invalid" ||
                        code === "pow_challenge_invalid" ||
                        code === "pow_invalid"
                    ) {
                        this.powHeaders.onAuthFailure(this.cfg)
                        res = await fetchOnce()
                    }
                }

                if (!res.ok) {
                    this.log.debug(
                        "Outbox GET not ok: instanceId={instanceId} status={status}",
                        {
                            instanceId: this.cfg.instanceId,
                            status: res.status,
                        },
                    )

                    throw new Error(`http_rest_v1: outbox HTTP ${res.status}`)
                }

                this.powHeaders.onSuccessfulResponse(this.cfg, res)

                await this.cfg.reconcileStoreEpoch(
                    res.headers.get(HTTP_REST_V1_STORE_EPOCH_HEADER),
                )

                this.log.trace(
                    "Outbox GET ok: instanceId={instanceId} status={status}",
                    {
                        instanceId: this.cfg.instanceId,
                        status: res.status,
                    },
                )

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

        let delivered = 0
        let skippedInvalidB64 = 0
        let skippedEmpty = 0

        for (const item of rawList) {
            if (!this.isPollFresh(myCycle, pollSignal)) {
                this.log.trace(
                    "Outbox delivery interrupted: stale cycle or abort instanceId={instanceId} cycle={cycle} deliveredSoFar={deliveredSoFar}",
                    {
                        instanceId: this.cfg.instanceId,
                        cycle: myCycle,
                        deliveredSoFar: delivered,
                    },
                )

                return true
            }

            if (typeof item !== "string" || !item.trim()) {
                skippedEmpty += 1
                continue
            }

            let bytes: Uint8Array

            try {
                bytes = base64ToBytes(item.trim())
            } catch {
                skippedInvalidB64 += 1
                continue
            }

            if (bytes.byteLength === 0) {
                skippedEmpty += 1
                continue
            }

            delivered += 1

            this.handler(bytes, {
                transportKind: HTTP_REST_V1_TRANSPORT_KIND,
                transportInstanceId: this.cfg.instanceId,
            })
        }

        if (rawList.length > 0) {
            this.log.debug(
                "Outbox batch summary: instanceId={instanceId} rawItems={rawItems} delivered={delivered} skippedInvalidB64={skippedInvalidB64} skippedEmpty={skippedEmpty}",
                {
                    instanceId: this.cfg.instanceId,
                    rawItems: rawList.length,
                    delivered,
                    skippedInvalidB64,
                    skippedEmpty,
                },
            )
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

            this.log.debug(
                "Outbox cursor advanced for paging: instanceId={instanceId}",
                { instanceId: this.cfg.instanceId },
            )

            return { nextSince: next, continuePaging: true }
        }

        if (sinceParam.length > 0) {
            await this.cfg.setOutboxCursor(sinceParam)

            this.log.debug(
                "Outbox cursor finalized at since: instanceId={instanceId}",
                { instanceId: this.cfg.instanceId },
            )
        } else {
            this.log.trace(
                "Outbox cursor unchanged (no next, empty since): instanceId={instanceId}",
                { instanceId: this.cfg.instanceId },
            )
        }

        return { nextSince: sinceParam, continuePaging: false }
    }

    private async runPoll(
        myCycle: number,
        pollSignal: AbortSignal,
    ): Promise<void> {
        if (!this.isPollFresh(myCycle, pollSignal)) {
            this.log.trace(
                "Outbox poll aborted before work: stale cycle or stopped instanceId={instanceId} cycle={cycle}",
                { instanceId: this.cfg.instanceId, cycle: myCycle },
            )

            return
        }

        try {
            extractDeploymentSecretFromBaseUrl(this.cfg.baseUrl)

            const basePath = this.resolveOutboxBasePath()
            let sinceParam = (await this.cfg.getOutboxCursor()) ?? ""

            this.log.debug(
                "Outbox poll start: instanceId={instanceId} cycle={cycle} hasStoredCursor={hasStoredCursor} basePath={basePath}",
                {
                    instanceId: this.cfg.instanceId,
                    cycle: myCycle,
                    hasStoredCursor: sinceParam.length > 0,
                    basePath,
                },
            )

            let pageIndex = 0

            while (this.isPollFresh(myCycle, pollSignal)) {
                let json = await this.fetchOutboxPageJson(
                    sinceParam,
                    basePath,
                    pollSignal,
                )

                const cursorAfterEpoch = await this.cfg.getOutboxCursor()

                if (
                    sinceParam.length > 0 &&
                    (cursorAfterEpoch === null || cursorAfterEpoch.length === 0)
                ) {
                    sinceParam = ""
                    json = await this.fetchOutboxPageJson(
                        sinceParam,
                        basePath,
                        pollSignal,
                    )
                }

                if (!this.isPollFresh(myCycle, pollSignal)) {
                    this.log.trace(
                        "Outbox poll exit after fetch: stale instanceId={instanceId} cycle={cycle} pageIndex={pageIndex}",
                        {
                            instanceId: this.cfg.instanceId,
                            cycle: myCycle,
                            pageIndex,
                        },
                    )

                    return
                }

                const messageCount = Array.isArray(json.messages)
                    ? json.messages.length
                    : 0

                this.log.debug(
                    "Outbox poll page: instanceId={instanceId} cycle={cycle} pageIndex={pageIndex} messageCount={messageCount} hasNextCursor={hasNextCursor}",
                    {
                        instanceId: this.cfg.instanceId,
                        cycle: myCycle,
                        pageIndex,
                        messageCount,
                        hasNextCursor:
                            typeof json.nextCursor === "string" &&
                            json.nextCursor.length > 0,
                    },
                )

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
                    this.log.trace(
                        "Outbox poll exit after delivery: stale instanceId={instanceId} cycle={cycle} pageIndex={pageIndex}",
                        {
                            instanceId: this.cfg.instanceId,
                            cycle: myCycle,
                            pageIndex,
                        },
                    )

                    return
                }

                const { nextSince, continuePaging } =
                    await this.applyOutboxCursorStep(json, sinceParam)

                sinceParam = nextSince
                pageIndex += 1

                if (!continuePaging) {
                    break
                }
            }

            this.log.debug(
                "Outbox poll completed: instanceId={instanceId} cycle={cycle} pages={pages}",
                {
                    instanceId: this.cfg.instanceId,
                    cycle: myCycle,
                    pages: pageIndex,
                },
            )
        } catch (e) {
            if (!this.stopped && !pollSignal.aborted) {
                this.log.warn(
                    "Outbox poll failed: instanceId={instanceId} cycle={cycle} error={error}",
                    {
                        instanceId: this.cfg.instanceId,
                        cycle: myCycle,
                        error: e,
                    },
                )
            } else {
                this.log.trace(
                    "Outbox poll error ignored (stopped or aborted): instanceId={instanceId} cycle={cycle} stopped={stopped} aborted={aborted}",
                    {
                        instanceId: this.cfg.instanceId,
                        cycle: myCycle,
                        stopped: this.stopped,
                        aborted: pollSignal.aborted,
                        error: e,
                    },
                )
            }
        }
    }
}
