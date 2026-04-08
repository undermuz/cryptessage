import { inject, injectable } from "inversify"

import { AuthService, type IAuthService } from "@/di/auth/types"
import type { CryptoProtocolId } from "@/di/crypt-db/crypto-protocol"
import {
    CryptDbProvider,
    type CryptDbService,
} from "@/di/crypt-db/types"
import type { ContactPlain, MessagePlain } from "@/di/crypt-db/types-data"
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
                cryptoProtocol: "compact_v1",
                compactX25519PublicKeyB64: bytesToBase64(v.x25519PublicKey),
                compactEd25519PublicKeyB64: bytesToBase64(v.ed25519PublicKey),
                createdAt: Date.now(),
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
            cryptoProtocol: "openpgp",
            publicKeyArmored: parsed.publicKeyArmored,
            createdAt: Date.now(),
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
            cryptoProtocol: contact.cryptoProtocol,
            channelPayload: bundle.channelStorage,
            outboundSelfPayload: bundle.outboundSelfStorage,
            createdAt: Date.now(),
        }

        await this.db.saveMessage(key, m)
        return m
    }

    public async saveInboundPayload(
        contactId: string,
        channelPayload: string,
        cryptoProtocol: CryptoProtocolId,
    ): Promise<MessagePlain> {
        const key = this.auth.getMasterKey()
        const m: MessagePlain = {
            id: crypto.randomUUID(),
            contactId,
            direction: "in",
            cryptoProtocol,
            channelPayload,
            createdAt: Date.now(),
        }

        await this.db.saveMessage(key, m)
        return m
    }

    public async listMessages(contactId: string): Promise<MessagePlain[]> {
        return this.db.listMessages(this.auth.getMasterKey(), contactId)
    }
}
