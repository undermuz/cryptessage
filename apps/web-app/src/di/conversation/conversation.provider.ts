import { inject, injectable } from "inversify"

import { AuthService, type IAuthService } from "@/di/auth/types"
import {
    CryptDbProvider,
    type CryptDbService,
} from "@/di/crypt-db/types"
import type { ContactPlain, MessagePlain } from "@/di/crypt-db/types-data"
import {
    OpenPgpCryptoService,
    type IOpenPgpCryptoService,
} from "@/di/openpgp-crypto/types"
import type { IConversationService } from "./types"

@injectable()
export class ConversationProvider implements IConversationService {
    @inject(AuthService)
    private readonly auth!: IAuthService

    @inject(CryptDbProvider)
    private readonly db!: CryptDbService

    @inject(OpenPgpCryptoService)
    private readonly pgp!: IOpenPgpCryptoService

    public async addContactFromVisitCard(
        rawCard: string,
        displayNameOverride?: string,
    ): Promise<ContactPlain> {
        const key = this.auth.getMasterKey()
        const parsed = this.pgp.parseVisitCard(rawCard)
        await this.pgp.validatePublicKeyArmored(parsed.publicKeyArmored)
        const c: ContactPlain = {
            id: crypto.randomUUID(),
            displayName:
                displayNameOverride?.trim() ||
                parsed.displayName.trim() ||
                "Contact",
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

    public async encryptOutgoingMessage(
        contactId: string,
        plaintext: string,
    ): Promise<string> {
        const contact = await this.getContact(contactId)
        if (!contact) {
            throw new Error("Contact not found")
        }
        return this.pgp.encryptAndSignForContact(
            plaintext,
            contact.publicKeyArmored,
        )
    }

    public async saveOutboundArmored(
        contactId: string,
        armored: string,
    ): Promise<MessagePlain> {
        const key = this.auth.getMasterKey()
        const m: MessagePlain = {
            id: crypto.randomUUID(),
            contactId,
            direction: "out",
            armoredPayload: armored,
            createdAt: Date.now(),
        }
        await this.db.saveMessage(key, m)
        return m
    }

    public async saveInboundArmored(
        contactId: string,
        armored: string,
    ): Promise<MessagePlain> {
        const key = this.auth.getMasterKey()
        const m: MessagePlain = {
            id: crypto.randomUUID(),
            contactId,
            direction: "in",
            armoredPayload: armored,
            createdAt: Date.now(),
        }
        await this.db.saveMessage(key, m)
        return m
    }

    public async listMessages(contactId: string): Promise<MessagePlain[]> {
        return this.db.listMessages(this.auth.getMasterKey(), contactId)
    }
}
