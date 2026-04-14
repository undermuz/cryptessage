import { inject, injectable } from "inversify"

import { AuthService, type IAuthService } from "@/di/auth/types"
import type { CryptoProtocolId } from "@/di/crypt-db/crypto-protocol"
import {
    CryptDbProvider,
    type CryptDbService,
} from "@/di/crypt-db/types"
import type {
    ContactPlain,
    MessagePlain,
    MessageTransportState,
} from "@/di/crypt-db/types-data"
import { isCompactVisitCardV1, decodeVisitCardV1 } from "@/di/compact-crypto/visit-card"
import {
    MessagingCryptoService,
    type EncryptedOutgoingBundle,
    type IMessagingCryptoService,
} from "@/di/messaging-crypto/types"
import {
    OpenPgpCryptoService,
    type IOpenPgpCryptoService,
    type VisitCardRawPayload,
} from "@/di/openpgp-crypto/types"
import { base64ToBytes, bytesToBase64 } from "@/di/secure/encoding"
import type { IConversationService, VisitCardInterpretation } from "./types"

@injectable()
export class ConversationProvider implements IConversationService {
    @inject(AuthService)
    private readonly auth!: IAuthService

    @inject(CryptDbProvider)
    private readonly db!: CryptDbService

    @inject(OpenPgpCryptoService)
    private readonly pgp!: IOpenPgpCryptoService

    @inject(MessagingCryptoService)
    private readonly messaging!: IMessagingCryptoService

    public async addContactFromVisitCard(
        rawCard: VisitCardRawPayload,
        displayNameOverride?: string,
        interpretation: VisitCardInterpretation = "auto",
    ): Promise<ContactPlain> {
        const key = this.auth.getMasterKey()

        const tryCompactBytes = (bytes: Uint8Array): ContactPlain | null => {
            if (!isCompactVisitCardV1(bytes)) {
                return null
            }

            const v = decodeVisitCardV1(bytes)

            return {
                id: crypto.randomUUID(),
                displayName:
                    displayNameOverride?.trim() ||
                    v.displayName.trim() ||
                    "Contact",
                createdAt: Date.now(),
                crypto: {
                    protocol: "compact_v1",
                    compact: {
                        x25519PublicKeyB64: bytesToBase64(v.x25519PublicKey),
                        ed25519PublicKeyB64: bytesToBase64(v.ed25519PublicKey),
                    },
                },
            }
        }

        if (interpretation === "compact_v1") {
            if (typeof rawCard === "string") {
                const bytes = base64ToBytes(rawCard.trim())
                const c = tryCompactBytes(bytes)

                if (!c) {
                    throw new Error("Invalid compact visit card")
                }

                await this.db.saveContact(key, c)
                return c
            }

            const c = tryCompactBytes(rawCard)

            if (!c) {
                throw new Error("Invalid compact visit card")
            }

            await this.db.saveContact(key, c)
            return c
        }

        if (interpretation !== "openpgp" && typeof rawCard !== "string") {
            const c = tryCompactBytes(rawCard)

            if (c) {
                await this.db.saveContact(key, c)
                return c
            }
        }

        if (interpretation === "auto" && typeof rawCard === "string") {
            try {
                const c = tryCompactBytes(base64ToBytes(rawCard.trim()))

                if (c) {
                    await this.db.saveContact(key, c)
                    return c
                }
            } catch {
                /* not valid base64 */
            }
        }

        const parsed = await this.pgp.parseVisitCard(rawCard)

        await this.pgp.validatePublicKeyArmored(parsed.publicKeyArmored)

        const c: ContactPlain = {
            id: crypto.randomUUID(),
            displayName:
                displayNameOverride?.trim() ||
                parsed.displayName.trim() ||
                "Contact",
            createdAt: Date.now(),
            crypto: {
                protocol: "openpgp",
                openpgp: { publicKeyArmored: parsed.publicKeyArmored },
            },
        }

        await this.db.saveContact(key, c)
        return c
    }

    public async listContacts(): Promise<ContactPlain[]> {
        return this.db.listContacts(this.auth.getMasterKey())
    }

    public async getContact(id: string): Promise<ContactPlain | null> {
        const all = await this.listContacts()

        return all.find((c) => c.id === id) ?? null
    }

    public async saveContact(c: ContactPlain): Promise<void> {
        await this.db.saveContact(this.auth.getMasterKey(), c)
    }

    public async deleteContact(id: string): Promise<void> {
        await this.db.deleteContact(this.auth.getMasterKey(), id)
    }

    public async encryptOutgoingBundle(
        contactId: string,
        plaintext: string,
    ): Promise<EncryptedOutgoingBundle> {
        const contact = await this.getContact(contactId)

        if (!contact) {
            throw new Error("Contact not found")
        }

        return this.messaging.encryptOutgoing(contact, plaintext)
    }

    public async saveOutboundBundle(
        contactId: string,
        bundle: EncryptedOutgoingBundle,
    ): Promise<MessagePlain> {
        const key = this.auth.getMasterKey()
        const contact = await this.getContact(contactId)

        if (!contact) {
            throw new Error("Contact not found")
        }

        const m: MessagePlain = {
            id: crypto.randomUUID(),
            contactId,
            direction: "out",
            createdAt: Date.now(),
            crypto: {
                protocol: contact.crypto.protocol,
                channelPayload: bundle.channelStorage,
                outboundSelfPayload: bundle.outboundSelfStorage,
            },
            transport: { state: "sending" },
        }

        await this.db.saveMessage(key, m)
        return m
    }

    public async setOutboundTransportState(
        messageId: string,
        state: MessageTransportState | undefined,
        detail?: { kind?: string; status?: number },
    ): Promise<void> {
        const key = this.auth.getMasterKey()
        const existing = await this.db.getMessageById(key, messageId)

        if (!existing || existing.direction !== "out") {
            return
        }

        const next: MessagePlain = {
            ...existing,
            transport: {
                ...existing.transport,
                ...(state ? { state } : {}),
                ...(detail?.kind !== undefined ? { kind: detail.kind } : {}),
                ...(detail?.status !== undefined ? { status: detail.status } : {}),
            },
        }

        await this.db.saveMessage(key, next)
    }

    public async saveInboundPayload(
        contactId: string,
        channelPayload: string,
        cryptoProtocol: CryptoProtocolId,
    ): Promise<MessagePlain> {
        const key = this.auth.getMasterKey()

        const canonicalBytesForId = (() => {
            const p = channelPayload.trim()

            // If upstream gives us bytes that are converted to armored OpenPGP text,
            // the armor may differ (headers, line wrapping) between runs.
            // Dedup should be based on the stable base64 body inside the armor.
            if (p.startsWith("-----BEGIN PGP MESSAGE-----")) {
                const lines = p.split(/\r?\n/)
                const out: string[] = []
                let inBody = false

                for (const line of lines) {
                    if (line.startsWith("-----END PGP MESSAGE-----")) {
                        break
                    }

                    if (inBody) {
                        const t = line.trim()
                        // Skip CRC24 checksum line (starts with '=')
                        if (t.length > 0 && !t.startsWith("=")) {
                            out.push(t)
                        }
                        continue
                    }

                    // Armor body starts after the first empty line following headers.
                    if (line.trim() === "") {
                        inBody = true
                    }
                }

                if (out.length > 0) {
                    try {
                        const b64 = out.join("")
                        return base64ToBytes(b64)
                    } catch {
                        // fall through
                    }
                }
            }

            // Compact ciphertext is stored as base64; hash bytes to be robust
            // against formatting differences.
            try {
                return base64ToBytes(p)
            } catch {
                return new TextEncoder().encode(p)
            }
        })()

        // Idempotency: the same inbound ciphertext may be observed multiple times
        // (polling retries, reload, server cursor glitches). Use a stable message id
        // so repeats overwrite instead of creating duplicates.
        const stableId = await (async () => {
            const prefix = new TextEncoder().encode(
                `${contactId}\nin\n${cryptoProtocol}\n`,
            )
            const joined = new Uint8Array(prefix.byteLength + canonicalBytesForId.byteLength)
            joined.set(prefix, 0)
            joined.set(canonicalBytesForId, prefix.byteLength)
            const digest = await crypto.subtle.digest(
                "SHA-256",
                joined as BufferSource,
            )
            const b64 = bytesToBase64(new Uint8Array(digest))
            return `in_${b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`
        })()

        const existing = await this.db.getMessageById(key, stableId)
        const createdAt =
            existing && existing.contactId === contactId && existing.direction === "in"
                ? existing.createdAt
                : Date.now()

        const m: MessagePlain = {
            id: stableId,
            contactId,
            direction: "in",
            createdAt,
            crypto: {
                protocol: cryptoProtocol,
                channelPayload,
            },
        }

        await this.db.saveMessage(key, m)
        return m
    }

    public async listMessages(contactId: string): Promise<MessagePlain[]> {
        return this.db.listMessages(this.auth.getMasterKey(), contactId)
    }
}
