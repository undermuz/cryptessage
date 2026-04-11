/** DI token for {@link IHttpRestInboundCoordinator}. */
export const HttpRestInboundCoordinator = Symbol.for(
    "HttpRestInboundCoordinator",
)

/**
 * Application hook: start/stop background HTTP outbox polling for all configured `http_rest_v1` profiles.
 * Implemented by {@link HttpRestInboundCoordinatorProvider}.
 */
/** UI flags for manual HTTP outbox refresh (see `enablePoll: false`). */
export type HttpRestManualInboundUi = {
    canManualRefresh: boolean
}

export type IHttpRestInboundCoordinator = {
    /**
     * When at least one `http_rest_v1` profile has `outboxSelfKeyId` and `enablePoll: false`,
     * the chat header can offer a one-shot outbox pull via {@link refreshManualHttpInboxes}.
     */
    readonly manualInboundUi: HttpRestManualInboundUi
    /**
     * Idempotent: unsubscribes previous listeners, then subscribes for each eligible profile.
     * No-op if the `http_rest_v1` transport is not registered.
     */
    start(): Promise<void>
    /** Tears down all subscriptions created by the last `start` (safe to call multiple times). */
    stop(): void
    /** Runs one outbox fetch cycle for every profile with automatic polling disabled. */
    refreshManualHttpInboxes(): Promise<void>
}

/** `http_rest_v1` PoW policy modes (mirrors server `clientHints.powMode`). */
export type HttpRestPowMode = "adaptive" | "always"

/** Optional hints from GET `/challenge` (ignored by PoW preimage). */
export type PowClientHints = {
    powMode: HttpRestPowMode
    idleMsBeforePow: number
    maxRps: number
    maxRpm: number
}

/** Server-issued challenge for `sha256-pow-v1` (GET `/challenge` JSON body). */
export type PowChallenge = {
    /** Must be `sha256-pow-v1` for the solver in `pow-sha256-pow-v1.ts`. */
    algorithm: string
    /** Base64url-encoded nonce bytes (decoded into the PoW preimage). */
    nonce: string
    /** Required leading zero bits in SHA-256 preimage hash. */
    difficultyBits: number
    /** ISO timestamp; client rejects expired challenges before grinding. */
    expiresAt: string
    /** Server policy for adaptive PoW / rate hints (optional; older servers omit). */
    clientHints?: PowClientHints
}

/**
 * Normalized `http_rest_v1` profile config after {@link HttpRestTransportProvider.parseConfig}.
 * Persisted as JSON on the transport profile; excludes subscribe-only cursor callbacks.
 */
export type HttpRestParsedConfig = {
    /** Server root including deployment secret, e.g. `https://host/<secret>/v1`. */
    baseUrl: string
    /** Optional `Authorization: Bearer …` for inbox/outbox requests. */
    bearerToken?: string
    /** Path template for POST inbox; must include `{recipientKeyId}`. */
    inboxPathTemplate: string
    /** When set, {@link HttpRestTransportProvider.subscribe} polls this mailbox id (server `selfKeyId`). */
    outboxSelfKeyId?: string
    /** Path template for GET outbox; must include `{selfKeyId}`. */
    outboxPathTemplate: string
    /** Interval between outbox poll kicks (clamped 1000–60000 ms). */
    pollIntervalMs: number
    /** Per-request timeout for fetch (clamped up to 120s). */
    timeoutMs: number
    /**
     * Skip PoW challenge/proof (allowed only for local/private base URLs such as localhost).
     */
    skipPow: boolean
    /**
     * When set, overrides server `clientHints.powMode` until the next challenge refresh.
     */
    powMode?: HttpRestPowMode
    /** Override server `idleMsBeforePow` (ms). */
    powIdleMsBeforePow?: number
    /** Override rolling1s request cap (client + server). */
    powMaxRps?: number
    /** Override rolling 60s request cap (client + server). */
    powMaxRpm?: number
    /**
     * When `false`, the app does not start an outbox poll interval for this profile; use
     * {@link IHttpRestInboundCoordinator.refreshManualHttpInboxes} from the chat UI instead.
     * When omitted or `true`, {@link pollIntervalMs} applies as before.
     */
    enablePoll: boolean
}

/**
 * Runtime config for {@link HttpRestTransportProvider.subscribe} (not persisted in profile JSON).
 * Supplied by the inbound coordinator / wiring layer.
 */
export type HttpRestSubscribeRuntimeConfig = HttpRestParsedConfig & {
    /** Transport profile instance id (mirrors `SenderTransportMeta.transportInstanceId` on delivery). */
    instanceId: string
    /** Opaque cursor from last successful outbox response (per profile). */
    getOutboxCursor: () => Promise<string | null>
    /** Persist cursor after each outbox page or empty poll. */
    setOutboxCursor: (cursor: string | null) => Promise<void>
}

/** JSON body shape for GET outbox responses. */
export type OutboxJsonResponse = {
    /** Server token for the next page; when absent, polling may stop after persisting `since`. */
    nextCursor?: string | null
    /** Base64-encoded ciphertext blobs. */
    messages?: unknown
}
