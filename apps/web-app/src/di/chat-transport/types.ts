import type { CryptoProtocolId } from "@/di/crypt-db/crypto-protocol"
import type { ContactPlain } from "@/di/crypt-db/types-data"
import type { EncryptedOutgoingBundle } from "@/di/messaging-crypto/types"

export const ChatTransport = Symbol.for("ChatTransport")

export const ChatTransportRegistry = Symbol.for("ChatTransportRegistry")

export const ChatTransportManager = Symbol.for("ChatTransportManager")

export const ChatTransportOutgoingStore = Symbol.for(
    "ChatTransportOutgoingStore",
)

export const TransportPrefsService = Symbol.for("TransportPrefsService")

export type Unsubscribe = () => void

export type TransportCapabilities = {
    supportsPush: boolean
    requiresUserActionForSend: boolean
    supportsSubscribe: boolean
}

export type RecipientTransportMeta = {
    contactId: string
    cryptoProtocol: CryptoProtocolId
    compactX25519PublicKeyB64?: string
    compactEd25519PublicKeyB64?: string
    publicKeyArmored?: string
    routingHint?: string
    /** Opaque inbox id for `http_rest_v1` (agreed out-of-band). */
    httpRestInboxRecipientKeyId?: string
}

export type SenderTransportMeta = {
    contactId?: string
    cryptoProtocol?: CryptoProtocolId
    transportInstanceId?: string
    transportKind?: string
}

export type IChatTransport = {
    readonly kind: string
    readonly capabilities: TransportCapabilities
    /** Normalize and validate JSON config from persisted profile; throw if invalid. */
    parseConfig(raw: unknown): unknown
    send(
        payload: Uint8Array,
        meta: RecipientTransportMeta,
        instanceConfig: unknown,
    ): Promise<void>
    subscribe(
        handler: (data: Uint8Array, meta: SenderTransportMeta) => void,
        instanceConfig: unknown,
    ): Unsubscribe
    forceReceive?(
        handler: (data: Uint8Array, meta: SenderTransportMeta) => void,
        instanceConfig: unknown,
    ): void
}

export type IChatTransportRegistry = {
    getByKind(kind: string): IChatTransport | undefined
    listKinds(): string[]
    getAll(): IChatTransport[]
}

export type ChatOutgoingPayload = {
    contactId: string
    meta: RecipientTransportMeta
    bundle: EncryptedOutgoingBundle
}

export type LastNetworkDelivery = {
    kind: string
    status: number
}

export type IChatTransportOutgoingStore = {
    readonly state: {
        pending: ChatOutgoingPayload | null
        lastNetworkDelivery: LastNetworkDelivery | null
    }
    setPending(payload: ChatOutgoingPayload | null): void
    setLastNetworkDelivery(detail: LastNetworkDelivery | null): void
}

export type TransportProfilePlain = {
    instanceId: string
    kind: string
    label: string
    config: Record<string, unknown>
    enabled: boolean
}

export type TransportPrefsPayloadV1 = {
    profiles: TransportProfilePlain[]
    defaultInstanceId: string | null
    /**
     * Last successful outbox cursor per `http_rest_v1` profile `instanceId`
     * (opaque server token, persisted across reloads).
     */
    httpRestOutboxCursorByInstanceId?: Record<string, string>
    /**
     * Last seen `X-Cryptessage-Store-Epoch` per `http_rest_v1` profile; when the header changes
     * (server restart), the outbox cursor for that profile is cleared.
     */
    httpRestStoreEpochByInstanceId?: Record<string, string>
}

export type ResolvedTransportProfile = TransportProfilePlain & {
    builtIn?: boolean
}

export type ITransportPrefsService = {
    load(): Promise<TransportPrefsPayloadV1>
    save(prefs: TransportPrefsPayloadV1): Promise<void>
    getHttpRestOutboxCursor(instanceId: string): Promise<string | null>
    setHttpRestOutboxCursor(
        instanceId: string,
        cursor: string | null,
    ): Promise<void>
    /**
     * If `epochHeader` is non-empty and differs from the last stored epoch for `instanceId`,
     * clears the HTTP REST outbox cursor for that profile, then stores the new epoch.
     */
    applyHttpRestStoreEpochFromHeader(
        instanceId: string,
        epochHeader: string | null,
    ): Promise<void>
}

export type IChatTransportManager = {
    send(
        contact: ContactPlain,
        bundle: EncryptedOutgoingBundle,
    ): Promise<{ usedInstanceId: string; usedKind: string }>
    /**
     * POST the pending outgoing again for a specific transport profile (e.g. after a failed
     * `http_rest_v1` attempt while the send modal still holds the same pending bundle).
     */
    retrySendByInstance(
        contact: ContactPlain,
        instanceId: string,
    ): Promise<void>
    clearOutgoing(): void
    orderProfilesForContact(
        contact: ContactPlain,
    ): Promise<ResolvedTransportProfile[]>
    getProfiles(): Promise<ResolvedTransportProfile[]>
}
