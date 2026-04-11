import { inject, injectable } from "inversify"
import { proxy } from "valtio"

import { HTTP_REST_V1_TRANSPORT_KIND } from "@/di/chat-transport/constants"
import type { ILoggerFactory } from "@/di/logger/types"
import type { ILogger } from "@/di/types/logger"
import {
    ChatThreadService,
    type IChatThreadService,
} from "@/di/chat-thread/types"
import {
    ChatTransportRegistry,
    type IChatTransportRegistry,
    TransportPrefsService,
    type ITransportPrefsService,
    type Unsubscribe,
} from "@/di/chat-transport/types"
import {
    ConversationService,
    type IConversationService,
} from "@/di/conversation/types"
import {
    MessagingCryptoService,
    type IMessagingCryptoService,
} from "@/di/messaging-crypto/types"
import { bytesToBase64 } from "@/di/secure/encoding"

import type { CreateHttpRestOutboxSubscription } from "./http-rest-outbox-subscription"
import { HttpRestOutboxSubscription } from "./http-rest-outbox-subscription"
import type {
    HttpRestManualInboundUi,
    HttpRestParsedConfig,
    HttpRestSubscribeRuntimeConfig,
    IHttpRestInboundCoordinator,
} from "./types"

/**
 * Wires outbox polling for every enabled `http_rest_v1` profile that has `outboxSelfKeyId`,
 * persists cursors via {@link ITransportPrefsService}, and saves decoded inbound payloads to the
 * vault. Profiles with `enablePoll: false` register for manual refresh only. Dedupes rapid
 * duplicate deliveries by SHA-256 of raw bytes.
 */
@injectable()
export class HttpRestInboundCoordinatorProvider implements IHttpRestInboundCoordinator {
    private readonly log: ILogger

    public readonly manualInboundUi: HttpRestManualInboundUi = proxy({
        canManualRefresh: false,
    })

    /** Loads profiles and persists per-instance HTTP outbox cursors. */
    @inject(TransportPrefsService)
    private readonly transportPrefs!: ITransportPrefsService

    /** Resolves the `http_rest_v1` transport implementation. */
    @inject(ChatTransportRegistry)
    private readonly registry!: IChatTransportRegistry

    /** Lists contacts and saves inbound messages. */
    @inject(ConversationService)
    private readonly conv!: IConversationService

    /** Maps raw ciphertext bytes to a contact + channel storage. */
    @inject(MessagingCryptoService)
    private readonly messaging!: IMessagingCryptoService

    /** Reloads the active thread when inbound targets the open contact. */
    @inject(ChatThreadService)
    private readonly chat!: IChatThreadService

    @inject("Factory<HttpRestOutboxSubscription>")
    private readonly createHttpRestOutboxSubscription!: CreateHttpRestOutboxSubscription

    constructor(@inject("Factory<Logger>") loggerFactory: ILoggerFactory) {
        this.log = loggerFactory("HttpRestInboundCoordinator")
    }

    /** Active `subscribe` teardown functions from the last {@link HttpRestInboundCoordinatorProvider.start}. */
    private unsubs: Unsubscribe[] = []

    /** Subscriptions with interval polling off (`enablePoll: false`); polled via {@link refreshManualHttpInboxes}. */
    private manualSubs: HttpRestOutboxSubscription[] = []
    /**
     * Recent inbound payload hashes (base64 SHA-256) with timestamps;
     * used to skip duplicate network deliveries within a TTL window.
     */
    private readonly recentInbound = new Map<string, number>()

    /**
     * @returns `true` if this hash should be processed; `false` if seen recently (dedupe).
     */
    private rememberInbound(hashB64: string): boolean {
        const now = Date.now()
        const TTL_MS = 5 * 60 * 1000
        const MAX = 2000

        // Prune opportunistically.
        if (this.recentInbound.size > MAX) {
            for (const [k, ts] of this.recentInbound) {
                if (now - ts > TTL_MS) {
                    this.recentInbound.delete(k)
                }

                if (this.recentInbound.size <= MAX) {
                    break
                }
            }
        }

        const prev = this.recentInbound.get(hashB64)

        if (prev !== undefined && now - prev <= TTL_MS) {
            return false
        }

        this.recentInbound.set(hashB64, now)
        return true
    }

    /** Unsubscribes all outbox polls started by {@link HttpRestInboundCoordinatorProvider.start}. */
    public stop(): void {
        for (const u of this.unsubs) {
            u()
        }

        this.unsubs = []
        this.manualSubs = []
        this.manualInboundUi.canManualRefresh = false
    }

    public async refreshManualHttpInboxes(): Promise<void> {
        await Promise.all(this.manualSubs.map((s) => s.pollOnce()))
    }

    /**
     * Clears prior subscriptions, then subscribes once per unique
     * `(baseUrl, outboxPathTemplate, outboxSelfKeyId)` for enabled profiles.
     */
    public async start(): Promise<void> {
        this.stop()

        const impl = this.registry.getByKind(HTTP_REST_V1_TRANSPORT_KIND)

        if (!impl) {
            return
        }

        const prefs = await this.transportPrefs.load()
        const subscribedKeys = new Set<string>()

        for (const profile of prefs.profiles) {
            if (
                !profile.enabled ||
                profile.kind !== HTTP_REST_V1_TRANSPORT_KIND
            ) {
                continue
            }

            let parsed: HttpRestParsedConfig

            try {
                parsed = impl.parseConfig(
                    profile.config,
                ) as HttpRestParsedConfig
            } catch (e) {
                this.log.warn(
                    "Skip profile (invalid config): instanceId={instanceId} error={error}",
                    { instanceId: profile.instanceId, error: e },
                )
                continue
            }

            if (!parsed.outboxSelfKeyId?.trim()) {
                continue
            }

            const instanceId = profile.instanceId
            // Prevent double subscription if user has duplicated profiles
            // pointing to the same outbox endpoint.
            const subKey = `${parsed.baseUrl}|${parsed.outboxPathTemplate}|${parsed.outboxSelfKeyId}`

            if (subscribedKeys.has(subKey)) {
                continue
            }

            subscribedKeys.add(subKey)

            const subscribeCfg: HttpRestSubscribeRuntimeConfig = {
                ...parsed,
                instanceId,
                getOutboxCursor: () =>
                    this.transportPrefs.getHttpRestOutboxCursor(instanceId),
                setOutboxCursor: (cursor) =>
                    this.transportPrefs.setHttpRestOutboxCursor(
                        instanceId,
                        cursor,
                    ),
            }

            const handler = (bytes: Uint8Array) => {
                void this.onInbound(bytes)
            }

            const selfKeyId = parsed.outboxSelfKeyId.trim()

            const sub = this.createHttpRestOutboxSubscription(
                subscribeCfg,
                selfKeyId,
                handler,
            )

            if (parsed.enablePoll) {
                sub.start()
            } else {
                this.manualSubs.push(sub)
            }

            this.unsubs.push(() => {
                sub.dispose()
            })
        }

        this.manualInboundUi.canManualRefresh = this.manualSubs.length > 0
    }

    /**
     * Dedupes by hash, resolves which contact the ciphertext belongs to, saves inbound payload,
     * refreshes chat UI if that contact is currently open.
     */
    private async onInbound(bytes: Uint8Array): Promise<void> {
        try {
            const digest = await crypto.subtle.digest(
                "SHA-256",
                bytes as BufferSource,
            )
            const hashB64 = bytesToBase64(new Uint8Array(digest))

            if (!this.rememberInbound(hashB64)) {
                return
            }

            const contacts = await this.conv.listContacts()
            const resolved = await this.messaging.tryResolveInboundContact(
                bytes,
                contacts,
            )

            if (!resolved) {
                return
            }

            await this.conv.saveInboundPayload(
                resolved.contactId,
                resolved.channelStorage,
                resolved.cryptoProtocol,
            )

            if (this.chat.state.contactId === resolved.contactId) {
                await this.chat.reload()
            }
        } catch (e) {
            this.log.warn("Inbound handle failed: {error}", { error: e })
        }
    }
}
