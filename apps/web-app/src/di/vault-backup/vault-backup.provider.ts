import { inject, injectable } from "inversify"

import { AuthService, type IAuthService } from "@/di/auth/types"
import {
    CryptDbProvider,
    type CryptDbService,
} from "@/di/crypt-db/types"
import { buildBackupFile, readBackupPlain } from "@/di/secure/backup-format"
import { deriveAesGcmKey } from "@/di/secure/kdf"
import type { IVaultBackupService } from "./types"

@injectable()
export class VaultBackupProvider implements IVaultBackupService {
    @inject(AuthService)
    private readonly auth!: IAuthService

    @inject(CryptDbProvider)
    private readonly db!: CryptDbService

    public async exportEncryptedBackup(): Promise<string> {
        const key = this.auth.getMasterKey()
        const salt = await this.db.readSalt()
        if (!salt) {
            throw new Error("No salt")
        }
        const plain = await this.db.exportPlain(key)
        return buildBackupFile(key, salt, plain)
    }

    public async importEncryptedBackup(
        passphrase: string,
        fileJson: string,
    ): Promise<void> {
        const { salt, plain } = await readBackupPlain(passphrase, fileJson)
        const masterKey = await deriveAesGcmKey(passphrase, salt)
        await this.db.importFullState(masterKey, salt, plain)
        this.auth.adoptUnlockedMasterKey(masterKey)
    }
}
