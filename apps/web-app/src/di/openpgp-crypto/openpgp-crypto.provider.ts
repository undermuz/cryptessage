import { inject, injectable } from "inversify"
import * as openpgp from "openpgp"

import { AuthService, type IAuthService } from "@/di/auth/types"
import {
    CryptDbProvider,
    type CryptDbService,
} from "@/di/crypt-db/types"
import type { IOpenPgpCryptoService } from "./types"

const VISIT_CARD_VERSION = 1

type VisitCardJson = { v: number; n: string; k: string }

/** Match armored public key even with extra text around it or different line endings. */
const PUBLIC_KEY_ARMOR =
    /-----BEGIN PGP PUBLIC KEY BLOCK-----[\r\n]+[\s\S]*?-----END PGP PUBLIC KEY BLOCK-----/i

function extractPublicKeyArmored(input: string): string | null {
    const m = input.trim().match(PUBLIC_KEY_ARMOR)
    return m ? m[0].trim() : null
}

/** OpenPGP key id / fingerprint style: only hex (+ spaces/colons). Cannot be used as a public key. */
function looksLikeFingerprintOrKeyId(raw: string): boolean {
    const t = raw.trim()
    if (!/^[\s:0-9a-fA-F]+$/.test(t)) {
        return false
    }
    const hex = t.replace(/[\s:]/g, "")
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
        return false
    }
    // 8 / 16 = key id; 40 = v4 fingerprint (most common paste mistake); 32 / 48 / 64 = other tooling
    return [8, 16, 32, 40, 48, 64].includes(hex.length)
}

@injectable()
export class OpenPgpCryptoProvider implements IOpenPgpCryptoService {
    @inject(AuthService)
    private readonly auth!: IAuthService

    @inject(CryptDbProvider)
    private readonly db!: CryptDbService

    private async getPrivateKey(): Promise<openpgp.PrivateKey> {
        const masterKey = this.auth.getMasterKey()
        const id = await this.db.getIdentity(masterKey)
        if (!id) {
            throw new Error("No identity")
        }
        return openpgp.readPrivateKey({
            armoredKey: id.privateKeyArmored,
        })
    }

    public async buildVisitCard(displayName: string): Promise<string> {
        const masterKey = this.auth.getMasterKey()
        const id = await this.db.getIdentity(masterKey)
        if (!id) {
            throw new Error("No identity")
        }
        const payload: VisitCardJson = {
            v: VISIT_CARD_VERSION,
            n: displayName,
            k: id.publicKeyArmored,
        }
        return JSON.stringify(payload)
    }

    public parseVisitCard(raw: string): {
        displayName: string
        publicKeyArmored: string
    } {
        const trimmed = raw.trim()
        if (!trimmed) {
            throw new Error("Empty input")
        }

        try {
            const j = JSON.parse(trimmed) as unknown
            if (
                j &&
                typeof j === "object" &&
                (j as VisitCardJson).v === VISIT_CARD_VERSION &&
                typeof (j as VisitCardJson).k === "string"
            ) {
                const rec = j as VisitCardJson
                const armored =
                    extractPublicKeyArmored(rec.k) ?? rec.k.trim()
                if (!PUBLIC_KEY_ARMOR.test(armored)) {
                    throw new Error(
                        'Visit card field "k" must include a PGP public key block (-----BEGIN PGP PUBLIC KEY BLOCK-----)',
                    )
                }
                return {
                    displayName:
                        typeof rec.n === "string" ? rec.n : "",
                    publicKeyArmored: armored,
                }
            }
        } catch (e) {
            if (e instanceof SyntaxError) {
                /* not JSON — try raw armored below */
            } else {
                throw e
            }
        }

        const armored = extractPublicKeyArmored(trimmed)
        if (armored) {
            return { displayName: "", publicKeyArmored: armored }
        }

        if (looksLikeFingerprintOrKeyId(trimmed)) {
            throw new Error(
                "You pasted a key fingerprint or key ID (hex), not a public key. " +
                    "A fingerprint only identifies a key — it cannot be used to encrypt. " +
                    "Ask your contact for a QR visit card, JSON visit card, or the full text from " +
                    "\"-----BEGIN PGP PUBLIC KEY BLOCK-----\" … \"-----END …\". " +
                    "In cryptessage Settings they can copy their full public key block.",
            )
        }

        throw new Error(
            "Expected JSON visit card {v, n, k} or an armored public key (-----BEGIN PGP PUBLIC KEY BLOCK-----)",
        )
    }

    public async validatePublicKeyArmored(armored: string): Promise<void> {
        try {
            await openpgp.readKey({ armoredKey: armored })
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            throw new Error(`Invalid OpenPGP public key: ${msg}`)
        }
    }

    public async encryptAndSignForContact(
        plaintext: string,
        recipientPublicKeyArmored: string,
    ): Promise<string> {
        const privateKey = await this.getPrivateKey()
        const recipientKey = await openpgp.readKey({
            armoredKey: recipientPublicKeyArmored,
        })
        const message = await openpgp.createMessage({ text: plaintext })
        const encrypted = await openpgp.encrypt({
            message,
            encryptionKeys: recipientKey,
            signingKeys: privateKey,
            format: "armored",
        })
        return encrypted as unknown as string
    }

    public async decryptAndVerify(
        armoredMessage: string,
        senderPublicKeyArmored: string,
    ): Promise<{ text: string; signaturesValid: boolean }> {
        const privateKey = await this.getPrivateKey()
        const senderKey = await openpgp.readKey({
            armoredKey: senderPublicKeyArmored,
        })
        const message = await openpgp.readMessage({
            armoredMessage,
        })
        const { data, signatures } = await openpgp.decrypt({
            message,
            decryptionKeys: privateKey,
            verificationKeys: senderKey,
        })
        const outText = await messagePayloadToUtf8(data)
        let signaturesValid = true
        for (const s of signatures) {
            try {
                await s.verified
            } catch {
                signaturesValid = false
            }
        }
        return { text: outText, signaturesValid }
    }
}

async function messagePayloadToUtf8(data: unknown): Promise<string> {
    if (typeof data === "string") {
        return data
    }
    if (data instanceof Uint8Array) {
        return new TextDecoder().decode(data)
    }
    if (data && typeof (data as ReadableStream<Uint8Array>).getReader === "function") {
        const buf = await new Response(data as ReadableStream).arrayBuffer()
        return new TextDecoder().decode(new Uint8Array(buf))
    }
    return new TextDecoder().decode(data as BufferSource)
}
