import { inject, injectable } from "inversify"

import { AuthService, type IAuthService } from "@/di/auth/types"
import { CryptDbProvider, type CryptDbService } from "@/di/crypt-db/types"
import type { ILoggerFactory } from "@/di/logger/types"
import { decryptUtf8, encryptUtf8 } from "@/di/secure/aes-gcm"
import type { ILogger } from "@/di/types/logger"

import { TRANSPORT_PREFS_META_KEY } from "./constants"
import type {
    ITransportPrefsService,
    TransportPrefsPayloadV1,
    TransportProfilePlain,
} from "./types"

const emptyPrefs = (): TransportPrefsPayloadV1 => ({
    profiles: [],
    defaultInstanceId: null,
})

/**
 * Persists {@link TransportPrefsPayloadV1} (user transport profiles, default instance,
 * HTTP REST outbox cursors) in vault metadata under {@link TRANSPORT_PREFS_META_KEY},
 * encrypted with the current master key.
 */
@injectable()
export class TransportPrefsProvider implements ITransportPrefsService {
    private readonly log: ILogger

    @inject(AuthService)
    private readonly auth!: IAuthService

    @inject(CryptDbProvider)
    private readonly db!: CryptDbService

    constructor(@inject("Factory<Logger>") loggerFactory: ILoggerFactory) {
        this.log = loggerFactory("TransportPrefs")
    }

    /**
     * Reads and decrypts prefs from meta storage; returns empty prefs when nothing is stored.
     *
     * @throws If decryption or JSON parsing fails (corrupt blob or wrong key material).
     */
    public async load(): Promise<TransportPrefsPayloadV1> {
        const mk = this.auth.getMasterKey()
        const blob = await this.db.readMetaEncrypted(TRANSPORT_PREFS_META_KEY)

        if (!blob) {
            return emptyPrefs()
        }

        try {
            const raw = await decryptUtf8(mk, blob)
            const j = JSON.parse(raw) as {
                profiles?: TransportProfilePlain[]
                defaultInstanceId?: string | null
                httpRestOutboxCursorByInstanceId?: unknown
                httpRestStoreEpochByInstanceId?: unknown
                httpRestOutboxCursorBoundEpochByInstanceId?: unknown
            }

            const cursors = j.httpRestOutboxCursorByInstanceId
            const epochs = j.httpRestStoreEpochByInstanceId
            const boundEpochs = j.httpRestOutboxCursorBoundEpochByInstanceId

            return {
                profiles: Array.isArray(j.profiles) ? j.profiles : [],
                defaultInstanceId:
                    typeof j.defaultInstanceId === "string"
                        ? j.defaultInstanceId
                        : null,
                httpRestOutboxCursorByInstanceId:
                    typeof cursors === "object" &&
                    cursors !== null &&
                    !Array.isArray(cursors)
                        ? (cursors as Record<string, string>)
                        : undefined,
                httpRestStoreEpochByInstanceId:
                    typeof epochs === "object" &&
                    epochs !== null &&
                    !Array.isArray(epochs)
                        ? (epochs as Record<string, string>)
                        : undefined,
                httpRestOutboxCursorBoundEpochByInstanceId:
                    typeof boundEpochs === "object" &&
                    boundEpochs !== null &&
                    !Array.isArray(boundEpochs)
                        ? (boundEpochs as Record<string, string>)
                        : undefined,
            }
        } catch (e) {
            this.log.warn(
                "Transport prefs load failed (decrypt or parse): error={error}",
                { error: e },
            )
            throw e
        }
    }

    /**
     * Encrypts and writes prefs. `httpRestOutboxCursorByInstanceId`:
     * - **omitted / `undefined`** — keep the cursor map already on disk (e.g. profile-only saves);
     * - **present** (including `{}`) — **replace** the stored map (caller passes the full desired
     *   map, including after deleting keys). Merging with `{ ...disk, ...prefs }` would never remove
     *   keys, so replacement is required for clears.
     *
     * @throws On encryption or meta write failure.
     */
    public async save(prefs: TransportPrefsPayloadV1): Promise<void> {
        const disk = await this.load()
        const prefsCursors = prefs.httpRestOutboxCursorByInstanceId
        const diskCursors = disk.httpRestOutboxCursorByInstanceId
        const cursors =
            prefsCursors !== undefined
                ? { ...prefsCursors }
                : { ...(diskCursors ?? {}) }

        const prefsEpochs = prefs.httpRestStoreEpochByInstanceId
        const diskEpochs = disk.httpRestStoreEpochByInstanceId
        const epochs = {
            ...diskEpochs,
            ...prefsEpochs,
        }

        const prefsBounds = prefs.httpRestOutboxCursorBoundEpochByInstanceId
        const diskBounds = disk.httpRestOutboxCursorBoundEpochByInstanceId
        const bounds =
            prefsBounds !== undefined
                ? { ...prefsBounds }
                : { ...(diskBounds ?? {}) }

        const merged: TransportPrefsPayloadV1 = {
            ...prefs,
            httpRestOutboxCursorByInstanceId:
                Object.keys(cursors).length > 0 ? cursors : undefined,
            httpRestStoreEpochByInstanceId:
                Object.keys(epochs).length > 0 ? epochs : undefined,
            httpRestOutboxCursorBoundEpochByInstanceId:
                Object.keys(bounds).length > 0 ? bounds : undefined,
        }

        const mk = this.auth.getMasterKey()

        try {
            const blob = await encryptUtf8(mk, JSON.stringify(merged))

            await this.db.writeMetaJson(TRANSPORT_PREFS_META_KEY, blob)
        } catch (e) {
            this.log.warn(
                "Transport prefs save failed: profileCount={profileCount} error={error}",
                {
                    profileCount: merged.profiles.length,
                    error: e,
                },
            )
            throw e
        }

        const cursorKeys = Object.keys(
            merged.httpRestOutboxCursorByInstanceId ?? {},
        )

        this.log.debug(
            "Transport prefs saved: profileCount={profileCount} hasDefault={hasDefault} outboxCursorInstances={outboxCursorInstances}",
            {
                profileCount: merged.profiles.length,
                hasDefault: merged.defaultInstanceId !== null,
                outboxCursorInstances: cursorKeys.length,
            },
        )
    }

    /**
     * Returns the persisted opaque outbox cursor for an `http_rest_v1` profile, or `null`.
     */
    public async getHttpRestOutboxCursor(
        instanceId: string,
    ): Promise<string | null> {
        const p = await this.load()
        const v = p.httpRestOutboxCursorByInstanceId?.[instanceId]

        return typeof v === "string" && v.length > 0 ? v : null
    }

    /**
     * Updates or clears the HTTP REST outbox cursor for `instanceId`. Empty string is treated
     * like `null` (cursor removed). Persists through `save`.
     */
    public async setHttpRestOutboxCursor(
        instanceId: string,
        cursor: string | null,
    ): Promise<void> {
        const clearing = cursor === null || cursor === ""

        const p = await this.load()
        const next: Record<string, string> = {
            ...(p.httpRestOutboxCursorByInstanceId ?? {}),
        }

        const nextBound: Record<string, string> = {
            ...(p.httpRestOutboxCursorBoundEpochByInstanceId ?? {}),
        }

        if (clearing) {
            delete next[instanceId]
            delete nextBound[instanceId]
        } else {
            const prev = next[instanceId]

            if (prev === cursor) {
                this.log.debug(
                    "HTTP REST outbox cursor unchanged: instanceId={instanceId} cursor={cursor}",
                    { instanceId, cursor },
                )
                return
            }

            next[instanceId] = cursor

            const epoch = p.httpRestStoreEpochByInstanceId?.[instanceId]

            if (typeof epoch === "string" && epoch.length > 0) {
                nextBound[instanceId] = epoch
            } else {
                delete nextBound[instanceId]
            }

            this.log.debug(
                "HTTP REST outbox cursor updated: instanceId={instanceId} prev={prev} cursor={cursor}",
                { instanceId, prev, cursor },
            )
        }

        await this.save({
            ...p,
            httpRestOutboxCursorByInstanceId: next,
            httpRestOutboxCursorBoundEpochByInstanceId: nextBound,
        })

        if (!clearing && cursor !== null) {
            const after = await this.load()
            const written = after.httpRestOutboxCursorByInstanceId?.[instanceId]

            if (written !== cursor) {
                this.log.warn(
                    "HTTP REST outbox cursor read-back mismatch after save: instanceId={instanceId} expectedCursor={expectedCursor} storedCursor={storedCursor}",
                    {
                        instanceId,
                        expectedCursor: cursor,
                        storedCursor: written ?? null,
                    },
                )
            }
        }

        if (clearing) {
            this.log.debug(
                "HTTP REST outbox cursor cleared: instanceId={instanceId}",
                { instanceId },
            )
        }
    }

    public async applyHttpRestStoreEpochFromHeader(
        instanceId: string,
        epochHeader: string | null,
    ): Promise<void> {
        const h = epochHeader?.trim() ?? ""

        if (h.length === 0) {
            return
        }

        const disk = await this.load()
        const prevRaw = disk.httpRestStoreEpochByInstanceId?.[instanceId]
        const prevEpoch =
            typeof prevRaw === "string" && prevRaw.length > 0 ? prevRaw : null

        const cursorRaw = disk.httpRestOutboxCursorByInstanceId?.[instanceId]
        const hasStoredOutboxCursor =
            typeof cursorRaw === "string" && cursorRaw.length > 0

        const boundRaw =
            disk.httpRestOutboxCursorBoundEpochByInstanceId?.[instanceId]
        const boundEpoch =
            typeof boundRaw === "string" && boundRaw.length > 0 ? boundRaw : null

        /**
         * - Restart: we already had an epoch and the server sends a different one.
         * - Upgrade/migration: we never stored an epoch (feature new) but still have an outbox
         *   cursor from before — must clear once so polling works against a new seq space.
         * - Stranded: stored epoch already matches the header (e.g. epoch was persisted earlier)
         *   but the opaque cursor was never re-written under that epoch — clear once.
         */
        const strandedEpochCursor =
            hasStoredOutboxCursor &&
            prevEpoch !== null &&
            prevEpoch === h &&
            (boundEpoch === null || boundEpoch !== h)

        const shouldClearCursor =
            (prevEpoch !== null && prevEpoch !== h) ||
            (prevEpoch === null && hasStoredOutboxCursor) ||
            strandedEpochCursor

        const nextCursors = {
            ...(disk.httpRestOutboxCursorByInstanceId ?? {}),
        }

        const nextBounds = {
            ...(disk.httpRestOutboxCursorBoundEpochByInstanceId ?? {}),
        }

        if (shouldClearCursor) {
            delete nextCursors[instanceId]
            delete nextBounds[instanceId]

            let clearReason:
                | "epoch_changed"
                | "first_epoch_with_existing_cursor"
                | "cursor_bound_epoch_missing"
                | "cursor_bound_epoch_mismatch"

            if (prevEpoch !== null && prevEpoch !== h) {
                clearReason = "epoch_changed"
            } else if (prevEpoch === null && hasStoredOutboxCursor) {
                clearReason = "first_epoch_with_existing_cursor"
            } else if (boundEpoch === null) {
                clearReason = "cursor_bound_epoch_missing"
            } else {
                clearReason = "cursor_bound_epoch_mismatch"
            }

            this.log.info(
                "HTTP REST store epoch applied; outbox cursor cleared: instanceId={instanceId} prevEpoch={prevEpoch} newEpoch={newEpoch} reason={reason}",
                {
                    instanceId,
                    prevEpoch,
                    newEpoch: h,
                    reason: clearReason,
                },
            )
        }

        const nextEpochs = {
            ...(disk.httpRestStoreEpochByInstanceId ?? {}),
            [instanceId]: h,
        }

        await this.save({
            ...disk,
            httpRestOutboxCursorByInstanceId: nextCursors,
            httpRestOutboxCursorBoundEpochByInstanceId: nextBounds,
            httpRestStoreEpochByInstanceId: nextEpochs,
        })
    }
}
