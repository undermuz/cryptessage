import { injectable } from "inversify"

import { CRYPT_DB_NAME, CRYPT_DB_VERSION } from "@/di/secure/constants"
import { bytesToBase64, base64ToBytes } from "@/di/secure/encoding"
import { decryptUtf8, encryptUtf8, type EncryptedBlob } from "@/di/secure/aes-gcm"
import type { CryptDbService } from "./types"
import { normalizeContact, normalizeMessage } from "./model-normalize"
import type { ContactPlain, IdentityPlain, MessagePlain } from "./types-data"

const STORE_META = "meta"
const STORE_IDENTITY = "identity"
const STORE_CONTACTS = "contacts"
const STORE_MESSAGES = "messages"

const KEY_SALT = "salt"
const KEY_PROFILE = "profile"

@injectable()
export class CryptDb implements CryptDbService {
    private db: IDBDatabase | null = null

    public async open(): Promise<void> {
        if (this.db) {
            return
        }

        this.db = await new Promise((resolve, reject) => {
            const req = indexedDB.open(CRYPT_DB_NAME, CRYPT_DB_VERSION)

            req.onerror = () => reject(req.error)
            req.onsuccess = () => resolve(req.result)

            req.onupgradeneeded = () => {
                const idb = req.result

                if (!idb.objectStoreNames.contains(STORE_META)) {
                    idb.createObjectStore(STORE_META)
                }

                if (!idb.objectStoreNames.contains(STORE_IDENTITY)) {
                    idb.createObjectStore(STORE_IDENTITY)
                }

                if (!idb.objectStoreNames.contains(STORE_CONTACTS)) {
                    idb.createObjectStore(STORE_CONTACTS, { keyPath: "id" })
                }

                if (!idb.objectStoreNames.contains(STORE_MESSAGES)) {
                    const s = idb.createObjectStore(STORE_MESSAGES, {
                        keyPath: "id",
                    })

                    s.createIndex("byContact", "contactId", { unique: false })
                }
            }
        })
    }

    private requireDb(): IDBDatabase {
        if (!this.db) {
            throw new Error("DB not open")
        }

        return this.db
    }

    public async readSalt(): Promise<Uint8Array | null> {
        await this.open()

        const idb = this.requireDb()
        const raw = await this.txGet<string>(idb, STORE_META, KEY_SALT)

        if (!raw) {
            return null
        }

        return base64ToBytes(raw)
    }

    public async writeSalt(salt: Uint8Array): Promise<void> {
        await this.open()

        const idb = this.requireDb()

        await this.txPutMeta(idb, KEY_SALT, bytesToBase64(salt))
    }

    public async readMetaEncrypted(key: string): Promise<EncryptedBlob | null> {
        await this.open()

        const idb = this.requireDb()
        const raw = await this.txGet<string>(idb, STORE_META, key)

        if (!raw) {
            return null
        }

        return JSON.parse(raw) as EncryptedBlob
    }

    public async writeMetaJson(key: string, blob: EncryptedBlob): Promise<void> {
        await this.open()

        const idb = this.requireDb()

        await this.txPutMeta(idb, key, JSON.stringify(blob))
    }

    public async getIdentity(masterKey: CryptoKey): Promise<IdentityPlain | null> {
        await this.open()

        const idb = this.requireDb()
        const row = await this.txGet<EncryptedRow>(
            idb,
            STORE_IDENTITY,
            KEY_PROFILE,
        )

        if (!row) {
            return null
        }

        const json = await decryptUtf8(masterKey, row.blob)

        return JSON.parse(json) as IdentityPlain
    }

    public async saveIdentity(
        masterKey: CryptoKey,
        identity: IdentityPlain,
    ): Promise<void> {
        await this.open()

        const idb = this.requireDb()
        const blob = await encryptUtf8(masterKey, JSON.stringify(identity))

        await this.txPutByKey(idb, STORE_IDENTITY, KEY_PROFILE, { blob })
    }

    public async listContacts(masterKey: CryptoKey): Promise<ContactPlain[]> {
        await this.open()

        const idb = this.requireDb()
        const rows = await this.getAll<ContactRow>(idb, STORE_CONTACTS)
        const out: ContactPlain[] = []

        for (const row of rows) {
            const json = await decryptUtf8(masterKey, row.blob)

            out.push(normalizeContact(JSON.parse(json) as ContactPlain))
        }

        return out.sort((a, b) => b.createdAt - a.createdAt)
    }

    public async saveContact(masterKey: CryptoKey, c: ContactPlain): Promise<void> {
        await this.open()

        const idb = this.requireDb()
        const blob = await encryptUtf8(masterKey, JSON.stringify(c))

        await this.txPutRow(idb, STORE_CONTACTS, { id: c.id, blob })
    }

    public async deleteContact(masterKey: CryptoKey, id: string): Promise<void> {
        await this.open()

        const idb = this.requireDb()

        await this.txDelete(idb, STORE_CONTACTS, id)

        const msgs = await this.listMessages(masterKey, id)

        for (const m of msgs) {
            await this.txDelete(idb, STORE_MESSAGES, m.id)
        }
    }

    public async listMessages(
        masterKey: CryptoKey,
        contactId: string,
    ): Promise<MessagePlain[]> {
        await this.open()

        const idb = this.requireDb()
        const rows = await this.getByIndex<MessageRow>(
            idb,
            STORE_MESSAGES,
            "byContact",
            contactId,
        )
        const out: MessagePlain[] = []

        for (const row of rows) {
            const json = await decryptUtf8(masterKey, row.blob)

            out.push(normalizeMessage(JSON.parse(json) as MessagePlain))
        }

        return out.sort((a, b) => a.createdAt - b.createdAt)
    }

    public async getMessageById(
        masterKey: CryptoKey,
        id: string,
    ): Promise<MessagePlain | null> {
        await this.open()

        const idb = this.requireDb()
        const row = await this.txGet<MessageRow>(idb, STORE_MESSAGES, id)

        if (!row) {
            return null
        }

        const json = await decryptUtf8(masterKey, row.blob)

        return normalizeMessage(JSON.parse(json) as MessagePlain)
    }

    public async saveMessage(masterKey: CryptoKey, m: MessagePlain): Promise<void> {
        await this.open()

        const idb = this.requireDb()
        const blob = await encryptUtf8(masterKey, JSON.stringify(m))

        await this.txPutRow(idb, STORE_MESSAGES, {
            id: m.id,
            contactId: m.contactId,
            blob,
        })
    }

    public async exportPlain(masterKey: CryptoKey): Promise<{
        contacts: ContactPlain[]
        messages: MessagePlain[]
        identity: IdentityPlain
    }> {
        const identity = await this.getIdentity(masterKey)

        if (!identity) {
            throw new Error("No identity")
        }

        const contacts = await this.listContacts(masterKey)
        const idb = this.requireDb()
        const allMsgRows = await this.getAll<MessageRow>(idb, STORE_MESSAGES)
        const messages: MessagePlain[] = []

        for (const row of allMsgRows) {
            const json = await decryptUtf8(masterKey, row.blob)

            messages.push(normalizeMessage(JSON.parse(json) as MessagePlain))
        }

        return { contacts, messages, identity }
    }

    public async importFullState(
        masterKey: CryptoKey,
        salt: Uint8Array,
        data: {
            contacts: ContactPlain[]
            messages: MessagePlain[]
            identity: IdentityPlain
        },
    ): Promise<void> {
        await this.wipe()
        await this.open()
        await this.writeSalt(salt)

        const check = await encryptUtf8(masterKey, "cryptessage_vault_ok")

        await this.writeMetaJson("_check", check)
        await this.saveIdentity(masterKey, data.identity)

        for (const c of data.contacts) {
            await this.saveContact(masterKey, c)
        }

        for (const m of data.messages) {
            await this.saveMessage(masterKey, m)
        }
    }

    public async wipe(): Promise<void> {
        this.db?.close()
        this.db = null
        await new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase(CRYPT_DB_NAME)

            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
        })
    }

    private txGet<T>(idb: IDBDatabase, store: string, key: string): Promise<T | undefined> {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(store, "readonly")
            const os = tx.objectStore(store)
            const r = os.get(key)

            r.onerror = () => reject(r.error)
            r.onsuccess = () => resolve(r.result as T | undefined)
        })
    }

    private txPutMeta(idb: IDBDatabase, key: string, value: unknown): Promise<void> {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(STORE_META, "readwrite")
            const os = tx.objectStore(STORE_META)
            const r = os.put(value, key)

            r.onerror = () => reject(r.error)
            r.onsuccess = () => resolve()
        })
    }

    private txPutByKey(
        idb: IDBDatabase,
        store: string,
        key: string,
        value: unknown,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(store, "readwrite")
            const os = tx.objectStore(store)
            const r = os.put(value, key)

            r.onerror = () => reject(r.error)
            r.onsuccess = () => resolve()
        })
    }

    private txPutRow(
        idb: IDBDatabase,
        store: string,
        value: Record<string, unknown> & { id: string },
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(store, "readwrite")
            const os = tx.objectStore(store)
            const r = os.put(value)

            r.onerror = () => reject(r.error)
            r.onsuccess = () => resolve()
        })
    }

    private txDelete(idb: IDBDatabase, store: string, key: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(store, "readwrite")
            const os = tx.objectStore(store)
            const r = os.delete(key)

            r.onerror = () => reject(r.error)
            r.onsuccess = () => resolve()
        })
    }

    private getAll<T>(idb: IDBDatabase, store: string): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(store, "readonly")
            const os = tx.objectStore(store)
            const r = os.getAll()

            r.onerror = () => reject(r.error)
            r.onsuccess = () => resolve((r.result as T[]) ?? [])
        })
    }

    private getByIndex<T>(
        idb: IDBDatabase,
        store: string,
        indexName: string,
        query: string,
    ): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const tx = idb.transaction(store, "readonly")
            const os = tx.objectStore(store)
            const idx = os.index(indexName)
            const r = idx.getAll(query)

            r.onerror = () => reject(r.error)
            r.onsuccess = () => resolve((r.result as T[]) ?? [])
        })
    }
}

type EncryptedRow = { blob: EncryptedBlob }
type ContactRow = { id: string; blob: EncryptedBlob }
type MessageRow = { id: string; contactId: string; blob: EncryptedBlob }
