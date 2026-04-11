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
            }

            const cursors = j.httpRestOutboxCursorByInstanceId

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
     * Encrypts and writes prefs. Merges `httpRestOutboxCursorByInstanceId`: **disk first, then
     * prefs**, so explicit cursor updates in `prefs` win over the re-read from disk, while
     * profile-only saves (no cursor map in `prefs`) keep existing cursors from disk.
     *
     * @throws On encryption or meta write failure.
     */
    public async save(prefs: TransportPrefsPayloadV1): Promise<void> {
        const disk = await this.load()
        const prefsCursors = prefs.httpRestOutboxCursorByInstanceId
        const diskCursors = disk.httpRestOutboxCursorByInstanceId
        const cursors = {
            ...diskCursors,
            ...prefsCursors,
        }

        if (prefsCursors && diskCursors) {
            for (const instanceId of Object.keys(prefsCursors)) {
                const fromPrefs = prefsCursors[instanceId]
                const fromDisk = diskCursors[instanceId]

                if (
                    fromDisk !== undefined &&
                    fromPrefs !== fromDisk &&
                    cursors[instanceId] === fromDisk
                ) {
                    this.log.warn(
                        "Transport prefs save: HTTP outbox cursor from prefs was overwritten by disk merge (same key): instanceId={instanceId} prefsCursor={prefsCursor} diskCursor={diskCursor} mergedCursor={mergedCursor}",
                        {
                            instanceId,
                            prefsCursor: fromPrefs,
                            diskCursor: fromDisk,
                            mergedCursor: cursors[instanceId],
                        },
                    )
                }
            }
        }

        const merged: TransportPrefsPayloadV1 = {
            ...prefs,
            httpRestOutboxCursorByInstanceId:
                Object.keys(cursors).length > 0 ? cursors : undefined,
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

        if (clearing) {
            delete next[instanceId]
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

            this.log.debug(
                "HTTP REST outbox cursor updated: instanceId={instanceId} prev={prev} cursor={cursor}",
                { instanceId, prev, cursor },
            )
        }

        await this.save({
            ...p,
            httpRestOutboxCursorByInstanceId:
                Object.keys(next).length > 0 ? next : undefined,
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
}
