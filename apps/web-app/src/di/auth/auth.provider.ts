import { inject, injectable } from "inversify"

import type { IAuthService } from "./types"
import { deriveAesGcmKey } from "@/di/secure/kdf"
import { decryptUtf8, encryptUtf8 } from "@/di/secure/aes-gcm"
import { CryptDbProvider, type CryptDbService } from "@/di/crypt-db/types"

const CHECK_STRING = "cryptessage_vault_ok"

@injectable()
export class AuthProvider implements IAuthService {
    @inject(CryptDbProvider)
    private readonly db!: CryptDbService

    private masterKey: CryptoKey | null = null

    public isUnlocked(): boolean {
        return this.masterKey !== null
    }

    public lock(): void {
        this.masterKey = null
    }

    public async hasVault(): Promise<boolean> {
        const salt = await this.db.readSalt()

        return salt !== null
    }

    public getMasterKey(): CryptoKey {
        if (!this.masterKey) {
            throw new Error("Vault is locked")
        }

        return this.masterKey
    }

    public adoptUnlockedMasterKey(masterKey: CryptoKey): void {
        this.masterKey = masterKey
    }

    public async bootstrapNewVault(passphrase: string): Promise<void> {
        if (await this.hasVault()) {
            throw new Error("Vault already exists")
        }

        const salt = crypto.getRandomValues(new Uint8Array(16))

        await this.db.writeSalt(salt)

        const key = await deriveAesGcmKey(passphrase, salt)
        const check = await encryptUtf8(key, CHECK_STRING)

        await this.db.writeMetaJson("_check", check)
        this.masterKey = key
    }

    public async unlock(passphrase: string): Promise<void> {
        const salt = await this.db.readSalt()

        if (!salt) {
            throw new Error("No vault found")
        }

        const key = await deriveAesGcmKey(passphrase, salt)
        const check = await this.db.readMetaEncrypted("_check")

        if (!check) {
            throw new Error("Vault is corrupted")
        }

        try {
            const s = await decryptUtf8(key, check)

            if (s !== CHECK_STRING) {
                throw new Error("Bad passphrase")
            }
        } catch {
            throw new Error("Bad passphrase")
        }

        this.masterKey = key
    }
}
