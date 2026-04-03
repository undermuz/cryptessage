import { inject, injectable } from "inversify"
import * as openpgp from "openpgp"

import { AuthService, type IAuthService } from "@/di/auth/types"
import {
    CryptDbProvider,
    type CryptDbService,
} from "@/di/crypt-db/types"
import type { IIdentityService } from "./types"

@injectable()
export class IdentityProvider implements IIdentityService {
    @inject(AuthService)
    private readonly auth!: IAuthService

    @inject(CryptDbProvider)
    private readonly db!: CryptDbService

    public async hasIdentity(): Promise<boolean> {
        const key = this.auth.getMasterKey()
        const id = await this.db.getIdentity(key)
        return id !== null
    }

    public async ensureIdentity(displayName: string): Promise<void> {
        const key = this.auth.getMasterKey()
        const existing = await this.db.getIdentity(key)
        if (existing) {
            return
        }
        const { privateKey, publicKey } = await openpgp.generateKey({
            userIDs: [{ name: displayName }],
            type: "ecc",
            curve: "ed25519Legacy",
            format: "armored",
        })
        await this.db.saveIdentity(key, {
            publicKeyArmored: publicKey,
            privateKeyArmored: privateKey,
        })
    }

    public async getPublicKeyArmored(): Promise<string> {
        const key = this.auth.getMasterKey()
        const id = await this.db.getIdentity(key)
        if (!id) {
            throw new Error("No identity")
        }
        return id.publicKeyArmored
    }

    public async getFingerprintHex(): Promise<string> {
        const armored = await this.getPublicKeyArmored()
        const pub = await openpgp.readKey({ armoredKey: armored })
        return pub.getFingerprint().toUpperCase()
    }

    public async getSelfDisplayName(): Promise<string> {
        const armored = await this.getPublicKeyArmored()
        const pub = await openpgp.readKey({ armoredKey: armored })
        const packet = pub.users[0]?.userID
        const raw = packet?.userID
        if (typeof raw === "string" && raw.trim()) {
            const namePart = raw.includes("<") ? raw.split("<")[0].trim() : raw
            return namePart || "User"
        }
        return "User"
    }
}
