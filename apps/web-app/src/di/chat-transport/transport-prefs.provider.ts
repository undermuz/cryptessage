import { inject, injectable } from "inversify"

import { AuthService, type IAuthService } from "@/di/auth/types"
import {
    CryptDbProvider,
    type CryptDbService,
} from "@/di/crypt-db/types"
import { decryptUtf8, encryptUtf8 } from "@/di/secure/aes-gcm"

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

@injectable()
export class TransportPrefsProvider implements ITransportPrefsService {
    @inject(AuthService)
    private readonly auth!: IAuthService

    @inject(CryptDbProvider)
    private readonly db!: CryptDbService

    public async load(): Promise<TransportPrefsPayloadV1> {
        const mk = this.auth.getMasterKey()
        const blob = await this.db.readMetaEncrypted(TRANSPORT_PREFS_META_KEY)

        if (!blob) {
            return emptyPrefs()
        }

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
    }

    public async save(prefs: TransportPrefsPayloadV1): Promise<void> {
        const disk = await this.load()
        const cursors = {
            ...prefs.httpRestOutboxCursorByInstanceId,
            ...disk.httpRestOutboxCursorByInstanceId,
        }
        const merged: TransportPrefsPayloadV1 = {
            ...prefs,
            httpRestOutboxCursorByInstanceId:
                Object.keys(cursors).length > 0 ? cursors : undefined,
        }

        const mk = this.auth.getMasterKey()
        const blob = await encryptUtf8(mk, JSON.stringify(merged))

        await this.db.writeMetaJson(TRANSPORT_PREFS_META_KEY, blob)
    }

    public async getHttpRestOutboxCursor(
        instanceId: string,
    ): Promise<string | null> {
        const p = await this.load()
        const v = p.httpRestOutboxCursorByInstanceId?.[instanceId]

        return typeof v === "string" && v.length > 0 ? v : null
    }

    public async setHttpRestOutboxCursor(
        instanceId: string,
        cursor: string | null,
    ): Promise<void> {
        const p = await this.load()
        const next: Record<string, string> = {
            ...(p.httpRestOutboxCursorByInstanceId ?? {}),
        }

        if (cursor === null || cursor === "") {
            delete next[instanceId]
        } else {
            next[instanceId] = cursor
        }

        await this.save({
            ...p,
            httpRestOutboxCursorByInstanceId:
                Object.keys(next).length > 0 ? next : undefined,
        })
    }
}
