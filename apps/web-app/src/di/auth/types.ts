export const AuthService = Symbol.for("AuthService")

export type IAuthService = {
    /** True after successful unlock or bootstrap */
    isUnlocked(): boolean
    /** Clears master key from memory */
    lock(): void
    /** Whether local vault metadata exists (salt in IDB) */
    hasVault(): Promise<boolean>
    /** First-time: create salt, persist, derive key, unlock */
    bootstrapNewVault(passphrase: string): Promise<void>
    /** Existing vault: verify passphrase and unlock */
    unlock(passphrase: string): Promise<void>
    /** Current AES-GCM key; throws if locked */
    getMasterKey(): CryptoKey
    /** After backup restore: set session key without passphrase in memory */
    adoptUnlockedMasterKey(masterKey: CryptoKey): void
}
