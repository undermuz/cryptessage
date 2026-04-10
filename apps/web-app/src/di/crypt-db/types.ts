import type { EncryptedBlob } from "@/di/secure/aes-gcm"
import type { ContactPlain, IdentityPlain, MessagePlain } from "./types-data"

export const CryptDbProvider = Symbol.for("CryptDbProvider")

export type CryptDbService = {
    open(): Promise<void>
    readSalt(): Promise<Uint8Array | null>
    writeSalt(salt: Uint8Array): Promise<void>
    readMetaEncrypted(key: string): Promise<EncryptedBlob | null>
    writeMetaJson(key: string, blob: EncryptedBlob): Promise<void>
    getIdentity(masterKey: CryptoKey): Promise<IdentityPlain | null>
    saveIdentity(masterKey: CryptoKey, identity: IdentityPlain): Promise<void>
    listContacts(masterKey: CryptoKey): Promise<ContactPlain[]>
    saveContact(masterKey: CryptoKey, c: ContactPlain): Promise<void>
    deleteContact(masterKey: CryptoKey, id: string): Promise<void>
    listMessages(masterKey: CryptoKey, contactId: string): Promise<MessagePlain[]>
    getMessageById(masterKey: CryptoKey, id: string): Promise<MessagePlain | null>
    saveMessage(masterKey: CryptoKey, m: MessagePlain): Promise<void>
    exportPlain(masterKey: CryptoKey): Promise<{
        contacts: ContactPlain[]
        messages: MessagePlain[]
        identity: IdentityPlain
    }>
    importFullState(
        masterKey: CryptoKey,
        salt: Uint8Array,
        data: {
            contacts: ContactPlain[]
            messages: MessagePlain[]
            identity: IdentityPlain
        },
    ): Promise<void>
    wipe(): Promise<void>
}
