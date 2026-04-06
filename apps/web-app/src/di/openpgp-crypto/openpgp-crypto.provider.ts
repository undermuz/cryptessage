import { inject, injectable } from "inversify"
import * as openpgp from "openpgp"

import { AuthService, type IAuthService } from "@/di/auth/types"
import {
    CryptDbProvider,
    type CryptDbService,
} from "@/di/crypt-db/types"
import { unwrapMessageQrPayload } from "@/di/secure/message-qr-binary"
import type { IOpenPgpCryptoService } from "./types"

const VISIT_CARD_JSON_VERSION = 1

/** Magic `CMV2` — cryptessage visit card, binary QR payload v2. */
const VISIT_CARD_BINARY_MAGIC = new Uint8Array([
    0x43, 0x4d, 0x56, 0x32,
])
const VISIT_CARD_BINARY_PAYLOAD_VERSION = 2

type VisitCardJson = { v: number; n: string; k: string }

/** Match armored public key even with extra text around it or different line endings. */
const PUBLIC_KEY_ARMOR =
    /-----BEGIN PGP PUBLIC KEY BLOCK-----[\r\n]+[\s\S]*?-----END PGP PUBLIC KEY BLOCK-----/i

function extractPublicKeyArmored(input: string): string | null {
    const m = input.trim().match(PUBLIC_KEY_ARMOR)
    return m ? m[0].trim() : null
}

/** Join armor chunks the same way OpenPGP `util.concat` would for string output. */
function joinArmorChunks(chunks: unknown[]): string {
    if (!chunks.length) {
        return ""
    }
    return chunks
        .map((c) =>
            typeof c === "string"
                ? c
                : c instanceof Uint8Array
                  ? new TextDecoder().decode(c)
                  : String(c),
        )
        .join("")
}

/**
 * `Message#armor()` returns a string, a native `ReadableStream`, or OpenPGP's `ArrayStream`
 * (subclass of `Array` with `readToEnd`; its `getReader()` returns a stub without `releaseLock`).
 */
async function messageArmorToString(armored: unknown): Promise<string> {
    if (typeof armored === "string") {
        return armored
    }
    if (
        armored &&
        Array.isArray(armored) &&
        typeof (armored as { readToEnd?: unknown }).readToEnd === "function"
    ) {
        const streamLike = armored as unknown as {
            readToEnd: (join: (c: unknown[]) => string) => Promise<unknown>
        }
        const out = await streamLike.readToEnd(joinArmorChunks)
        return typeof out === "string" ? out : String(out)
    }
    if (
        armored &&
        typeof (armored as ReadableStream<Uint8Array | string>).getReader ===
            "function"
    ) {
        const reader = (
            armored as ReadableStream<Uint8Array | string>
        ).getReader()
        const parts: string[] = []
        try {
            for (;;) {
                const { done, value } = await reader.read()
                if (done) {
                    break
                }
                if (typeof value === "string") {
                    parts.push(value)
                } else if (value instanceof Uint8Array) {
                    parts.push(new TextDecoder().decode(value))
                }
            }
            return parts.join("")
        } finally {
            reader.releaseLock?.()
        }
    }
    return String(armored)
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
    return [8, 16, 32, 40, 48, 64].includes(hex.length)
}

function isBinaryVisitMagic(bytes: Uint8Array): boolean {
    return (
        bytes.byteLength >= 4 &&
        bytes[0] === VISIT_CARD_BINARY_MAGIC[0] &&
        bytes[1] === VISIT_CARD_BINARY_MAGIC[1] &&
        bytes[2] === VISIT_CARD_BINARY_MAGIC[2] &&
        bytes[3] === VISIT_CARD_BINARY_MAGIC[3]
    )
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
            v: VISIT_CARD_JSON_VERSION,
            n: displayName,
            k: id.publicKeyArmored,
        }
        return JSON.stringify(payload)
    }

    public async buildVisitCardBinary(displayName: string): Promise<Uint8Array> {
        const masterKey = this.auth.getMasterKey()
        const id = await this.db.getIdentity(masterKey)
        if (!id) {
            throw new Error("No identity")
        }
        const key = await openpgp.readKey({
            armoredKey: id.publicKeyArmored,
        })
        const keyBin = key.write()
        const nameUtf8 = new TextEncoder().encode(displayName)
        if (nameUtf8.length > 65535) {
            throw new Error("Display name is too long for visit card")
        }
        const out = new Uint8Array(
            4 +
                1 +
                2 +
                nameUtf8.byteLength +
                4 +
                keyBin.byteLength,
        )
        let o = 0
        out.set(VISIT_CARD_BINARY_MAGIC, o)
        o += 4
        out[o++] = VISIT_CARD_BINARY_PAYLOAD_VERSION
        out[o++] = (nameUtf8.length >> 8) & 0xff
        out[o++] = nameUtf8.length & 0xff
        out.set(nameUtf8, o)
        o += nameUtf8.length
        const kl = keyBin.byteLength
        out[o++] = (kl >>> 24) & 0xff
        out[o++] = (kl >>> 16) & 0xff
        out[o++] = (kl >>> 8) & 0xff
        out[o++] = kl & 0xff
        out.set(keyBin, o)
        return out
    }

    public async parseVisitCard(
        raw: string | Uint8Array,
    ): Promise<{ displayName: string; publicKeyArmored: string }> {
        if (typeof raw === "string") {
            const trimmed = raw.trim()
            if (!trimmed) {
                throw new Error("Empty input")
            }
            const asUtf8 = new TextEncoder().encode(trimmed)
            if (isBinaryVisitMagic(asUtf8)) {
                return this.parseVisitCardBinary(asUtf8)
            }
            return this.parseVisitCardText(trimmed)
        }

        if (!raw.byteLength) {
            throw new Error("Empty input")
        }
        if (isBinaryVisitMagic(raw)) {
            return this.parseVisitCardBinary(raw)
        }
        const asText = new TextDecoder("utf-8", { fatal: false }).decode(raw).trim()
        return this.parseVisitCardText(asText)
    }

    private async parseVisitCardBinary(
        bytes: Uint8Array,
    ): Promise<{ displayName: string; publicKeyArmored: string }> {
        if (bytes.byteLength < 11) {
            throw new Error("Binary visit card is too short")
        }
        let o = 4
        const ver = bytes[o++]
        if (ver !== VISIT_CARD_BINARY_PAYLOAD_VERSION) {
            throw new Error(
                `Unsupported binary visit card version: ${ver} (expected ${VISIT_CARD_BINARY_PAYLOAD_VERSION})`,
            )
        }
        const nameLen = (bytes[o] << 8) | bytes[o + 1]
        o += 2
        if (o + nameLen + 4 > bytes.byteLength) {
            throw new Error("Invalid binary visit card layout (name)")
        }
        const displayName = new TextDecoder().decode(bytes.subarray(o, o + nameLen))
        o += nameLen
        const keyLen =
            (bytes[o] << 24) |
            (bytes[o + 1] << 16) |
            (bytes[o + 2] << 8) |
            bytes[o + 3]
        o += 4
        if (keyLen < 1 || o + keyLen > bytes.byteLength) {
            throw new Error("Invalid binary visit card layout (key size)")
        }
        const keyBytes = bytes.subarray(o, o + keyLen)
        const key = await openpgp.readKey({ binaryKey: keyBytes })
        return {
            displayName,
            publicKeyArmored: key.armor(),
        }
    }

    private parseVisitCardText(trimmed: string): Promise<{
        displayName: string
        publicKeyArmored: string
    }> {
        try {
            const j = JSON.parse(trimmed) as unknown
            if (
                j &&
                typeof j === "object" &&
                (j as VisitCardJson).v === VISIT_CARD_JSON_VERSION &&
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
                return Promise.resolve({
                    displayName:
                        typeof rec.n === "string" ? rec.n : "",
                    publicKeyArmored: armored,
                })
            }
        } catch (e) {
            if (e instanceof SyntaxError) {
                /* not JSON — try raw armored below */
            } else {
                return Promise.reject(e)
            }
        }

        const armored = extractPublicKeyArmored(trimmed)
        if (armored) {
            return Promise.resolve({
                displayName: "",
                publicKeyArmored: armored,
            })
        }

        if (looksLikeFingerprintOrKeyId(trimmed)) {
            return Promise.reject(
                new Error(
                    "You pasted a key fingerprint or key ID (hex), not a public key. " +
                        "A fingerprint only identifies a key — it cannot be used to encrypt. " +
                        "Ask your contact for a QR visit card, JSON visit card, or the full text from " +
                        '"-----BEGIN PGP PUBLIC KEY BLOCK-----" … "-----END …". ' +
                        "In cryptessage Settings they can copy their full public key block.",
                ),
            )
        }

        return Promise.reject(
            new Error(
                "Expected binary visit card (CMV2), JSON visit card {v, n, k}, or an armored public key (-----BEGIN PGP PUBLIC KEY BLOCK-----)",
            ),
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

    public async encryptAndSignForContactBinary(
        plaintext: string,
        recipientPublicKeyArmored: string,
    ): Promise<Uint8Array> {
        const privateKey = await this.getPrivateKey()
        const recipientKey = await openpgp.readKey({
            armoredKey: recipientPublicKeyArmored,
        })
        const message = await openpgp.createMessage({ text: plaintext })
        const encrypted = await openpgp.encrypt({
            message,
            encryptionKeys: recipientKey,
            signingKeys: privateKey,
            format: "binary",
        })
        return encrypted as unknown as Uint8Array
    }

    public async encryptAndSignForContactBundle(
        plaintext: string,
        recipientPublicKeyArmored: string,
    ): Promise<{ armored: string; binary: Uint8Array }> {
        const binary = await this.encryptAndSignForContactBinary(
            plaintext,
            recipientPublicKeyArmored,
        )
        const packetMsg = await openpgp.readMessage({
            binaryMessage: binary,
        })
        return {
            binary,
            armored: await messageArmorToString(packetMsg.armor()),
        }
    }

    public async encryptAndSignForContact(
        plaintext: string,
        recipientPublicKeyArmored: string,
    ): Promise<string> {
        const { armored } = await this.encryptAndSignForContactBundle(
            plaintext,
            recipientPublicKeyArmored,
        )
        return armored
    }

    public async decryptAndVerify(
        ciphertext: string | Uint8Array,
        senderPublicKeyArmored: string,
    ): Promise<{ text: string; signaturesValid: boolean }> {
        const privateKey = await this.getPrivateKey()
        const senderKey = await openpgp.readKey({
            armoredKey: senderPublicKeyArmored,
        })
        const message =
            typeof ciphertext === "string"
                ? await openpgp.readMessage({
                      armoredMessage: ciphertext.trim(),
                  })
                : await openpgp.readMessage({
                      binaryMessage: unwrapMessageQrPayload(ciphertext),
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

    public async ciphertextToArmored(
        ciphertext: string | Uint8Array,
    ): Promise<string> {
        if (typeof ciphertext === "string") {
            const t = ciphertext.trim()
            if (!t.startsWith("-----BEGIN PGP MESSAGE")) {
                throw new Error("Expected armored OpenPGP message")
            }
            return t
        }
        const inner = unwrapMessageQrPayload(ciphertext)
        const packetMsg = await openpgp.readMessage({
            binaryMessage: inner,
        })
        return messageArmorToString(packetMsg.armor())
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
