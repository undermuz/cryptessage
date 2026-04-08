import { bytesToBase64, base64ToBytes } from "./encoding"
import { aesGcmEncrypt, decryptUtf8, type EncryptedBlob } from "./aes-gcm"
import { deriveAesGcmKey } from "./kdf"
import type { ContactPlain, IdentityPlain, MessagePlain } from "../crypt-db/types-data"

export const BACKUP_FORMAT_VERSION = 1 as const

export type BackupFileV1 = {
    format: typeof BACKUP_FORMAT_VERSION
    saltB64: string
    ivB64: string
    ciphertextB64: string
}

export type BackupPlainPayload = {
    contacts: ContactPlain[]
    messages: MessagePlain[]
    identity: IdentityPlain
}

export function serializeBackupFile(payload: BackupFileV1): string {
    return JSON.stringify(payload)
}

export function parseBackupFile(json: string): BackupFileV1 {
    const raw = JSON.parse(json) as unknown

    if (
        !raw ||
        typeof raw !== "object" ||
        (raw as BackupFileV1).format !== BACKUP_FORMAT_VERSION ||
        typeof (raw as BackupFileV1).saltB64 !== "string" ||
        typeof (raw as BackupFileV1).ivB64 !== "string" ||
        typeof (raw as BackupFileV1).ciphertextB64 !== "string"
    ) {
        throw new Error("Invalid backup file")
    }

    return raw as BackupFileV1
}

export async function buildBackupFile(
    masterKey: CryptoKey,
    salt: Uint8Array,
    plain: BackupPlainPayload,
): Promise<string> {
    const utf8 = JSON.stringify(plain)
    const blob: EncryptedBlob = await aesGcmEncrypt(
        masterKey,
        new TextEncoder().encode(utf8),
    )
    const file: BackupFileV1 = {
        format: BACKUP_FORMAT_VERSION,
        saltB64: bytesToBase64(salt),
        ivB64: blob.ivB64,
        ciphertextB64: blob.ciphertextB64,
    }

    return serializeBackupFile(file)
}

export async function readBackupPlain(
    passphrase: string,
    fileJson: string,
): Promise<{ salt: Uint8Array; plain: BackupPlainPayload }> {
    const file = parseBackupFile(fileJson)
    const salt = base64ToBytes(file.saltB64)
    const key = await deriveAesGcmKey(passphrase, salt)
    const utf8 = await decryptUtf8(key, {
        ivB64: file.ivB64,
        ciphertextB64: file.ciphertextB64,
    })
    const plain = JSON.parse(utf8) as BackupPlainPayload

    if (!plain.identity || !Array.isArray(plain.contacts) || !Array.isArray(plain.messages)) {
        throw new Error("Invalid backup payload")
    }

    return { salt, plain }
}

/** For tests: roundtrip encrypt/decrypt of backup payload with a known key. */
export async function encryptPlainPayload(
    masterKey: CryptoKey,
    plain: BackupPlainPayload,
): Promise<EncryptedBlob> {
    return aesGcmEncrypt(masterKey, new TextEncoder().encode(JSON.stringify(plain)))
}

export async function decryptPlainPayload(
    masterKey: CryptoKey,
    blob: EncryptedBlob,
): Promise<BackupPlainPayload> {
    const utf8 = await decryptUtf8(masterKey, blob)

    return JSON.parse(utf8) as BackupPlainPayload
}
