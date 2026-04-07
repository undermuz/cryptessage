import { inject, injectable } from "inversify"
import * as openpgp from "openpgp"

import { AuthService, type IAuthService } from "@/di/auth/types"
import {
    CryptDbProvider,
    type CryptDbService,
} from "@/di/crypt-db/types"
import { encodeVisitCardV1 } from "@/di/compact-crypto/visit-card"
import { generateCompactIdentitySecrets } from "@/di/compact-crypto/compact-identity"
import { base64ToBytes } from "@/di/secure/encoding"
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
            compactIdentity: generateCompactIdentitySecrets(),
        })
    }

    public async ensureCompactIdentity(): Promise<void> {
        const key = this.auth.getMasterKey()
        const existing = await this.db.getIdentity(key)

        if (!existing) {
            return
        }

        if (existing.compactIdentity) {
            return
        }

        await this.db.saveIdentity(key, {
            ...existing,
            compactIdentity: generateCompactIdentitySecrets(),
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

    public async buildCompactVisitCard(displayName: string): Promise<Uint8Array> {
        await this.ensureCompactIdentity()
        const key = this.auth.getMasterKey()
        const id = await this.db.getIdentity(key)

        if (!id?.compactIdentity) {
            throw new Error("No compact identity")
        }

        const xPub = base64ToBytes(id.compactIdentity.x25519PublicKeyB64)
        const edPub = base64ToBytes(id.compactIdentity.ed25519PublicKeyB64)
        return encodeVisitCardV1(displayName.trim() || "User", xPub, edPub)
    }
}
