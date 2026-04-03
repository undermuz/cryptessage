export const VaultBackupService = Symbol.for("VaultBackupService")

export type IVaultBackupService = {
    exportEncryptedBackup(): Promise<string>
    importEncryptedBackup(passphrase: string, fileJson: string): Promise<void>
}
