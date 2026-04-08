import { inject, injectable } from "inversify"

import { AuthService, type IAuthService } from "@/di/auth/types"
import type { CryptoProtocolId } from "@/di/crypt-db/crypto-protocol"
import { DEFAULT_CRYPTO_PROTOCOL } from "@/di/crypt-db/crypto-protocol"
import {
    CryptDbProvider,
    type CryptDbService,
} from "@/di/crypt-db/types"
import { decryptUtf8, encryptUtf8 } from "@/di/secure/aes-gcm"
import type { ICryptoPrefsService } from "./types"

const META_KEY = "crypto_prefs_v1"

type PrefsJson = { defaultVisitCardFormat?: CryptoProtocolId }

@injectable()
export class CryptoPrefsProvider implements ICryptoPrefsService {
    @inject(AuthService)
    private readonly auth!: IAuthService

    @inject(CryptDbProvider)
    private readonly db!: CryptDbService

    public async getDefaultVisitCardFormat(): Promise<CryptoProtocolId> {
        const mk = this.auth.getMasterKey()
        const blob = await this.db.readMetaEncrypted(META_KEY)

        if (!blob) {
            return DEFAULT_CRYPTO_PROTOCOL
        }

        const raw = await decryptUtf8(mk, blob)
        const j = JSON.parse(raw) as PrefsJson

        return j.defaultVisitCardFormat === "compact_v1"
            ? "compact_v1"
            : DEFAULT_CRYPTO_PROTOCOL
    }

    public async setDefaultVisitCardFormat(
        protocol: CryptoProtocolId,
    ): Promise<void> {
        const mk = this.auth.getMasterKey()
        const payload: PrefsJson = { defaultVisitCardFormat: protocol }
        const blob = await encryptUtf8(mk, JSON.stringify(payload))

        await this.db.writeMetaJson(META_KEY, blob)
    }
}
