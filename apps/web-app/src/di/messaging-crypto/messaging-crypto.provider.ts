import { inject, injectable } from "inversify"

import { AuthService, type IAuthService } from "@/di/auth/types"
import type { CryptoProtocolId } from "@/di/crypt-db/crypto-protocol"
import { CryptDbProvider, type CryptDbService } from "@/di/crypt-db/types"
import type { ContactPlain } from "@/di/crypt-db/types-data"
import {
    decryptCompactMessage,
    encryptCompactMessage,
} from "@/di/compact-crypto/compact-message"
import { COMPACT_MESSAGE_VERSION } from "@/di/compact-crypto/compact-constants"
import {
    OpenPgpCryptoService,
    type IOpenPgpCryptoService,
    type VisitCardRawPayload,
} from "@/di/openpgp-crypto/types"
import { base64ToBytes, bytesToBase64 } from "@/di/secure/encoding"
import {
    unwrapMessageQrPayload,
    wrapCompactBinaryForMessageQr,
    wrapOpenPgpBinaryForMessageQr,
} from "@/di/secure/message-qr-binary"
import type {
    EncryptedOutgoingBundle,
    IMessagingCryptoService,
    ScannedPayloadNormalized,
} from "./types"

@injectable()
export class MessagingCryptoProvider implements IMessagingCryptoService {
    @inject(AuthService)
    private readonly auth!: IAuthService

    @inject(CryptDbProvider)
    private readonly db!: CryptDbService

    @inject(OpenPgpCryptoService)
    private readonly pgp!: IOpenPgpCryptoService

    private async requireIdentity() {
        const key = this.auth.getMasterKey()
        const id = await this.db.getIdentity(key)

        if (!id) {
            throw new Error("No identity")
        }

        return id
    }

    public async encryptOutgoing(
        contact: ContactPlain,
        plaintext: string,
    ): Promise<EncryptedOutgoingBundle> {
        if (contact.cryptoProtocol === "compact_v1") {
            const id = await this.requireIdentity()

            if (!id.compactIdentity) {
                throw new Error("Compact identity not initialized")
            }

            const xSec = base64ToBytes(id.compactIdentity.x25519SecretKeyB64)
            const edSec = base64ToBytes(id.compactIdentity.ed25519SecretKeyB64)
            const xb64 = contact.compactX25519PublicKeyB64

            if (!xb64) {
                throw new Error("Contact missing compact X25519 public key")
            }

            const recipX = base64ToBytes(xb64)
            const packet = encryptCompactMessage(
                plaintext,
                recipX,
                xSec,
                edSec,
            )
            const selfX = base64ToBytes(id.compactIdentity.x25519PublicKeyB64)
            const selfPacket = encryptCompactMessage(
                plaintext,
                selfX,
                xSec,
                edSec,
            )
            return {
                channelStorage: bytesToBase64(packet),
                outboundSelfStorage: bytesToBase64(selfPacket),
                qrPayloadBinary: wrapCompactBinaryForMessageQr(packet),
            }
        }

        const pk = contact.publicKeyArmored

        if (!pk) {
            throw new Error("Contact has no OpenPGP public key")
        }

        const bundle = await this.pgp.encryptAndSignForContactBundle(
            plaintext,
            pk,
        )
        const identity = await this.requireIdentity()
        const selfArmored = await this.pgp.encryptAndSignForContact(
            plaintext,
            identity.publicKeyArmored,
        )
        return {
            channelStorage: bundle.armored,
            outboundSelfStorage: selfArmored,
            qrPayloadBinary: wrapOpenPgpBinaryForMessageQr(bundle.binary),
        }
    }

    public async decryptIncoming(
        contact: ContactPlain,
        channelPayload: string | Uint8Array,
        messageProtocol: CryptoProtocolId,
    ): Promise<{ text: string; signaturesValid: boolean }> {
        if (messageProtocol === "compact_v1") {
            const id = await this.requireIdentity()

            if (!id.compactIdentity) {
                throw new Error("Compact identity not initialized")
            }

            const bytes =
                typeof channelPayload === "string"
                    ? base64ToBytes(channelPayload.trim())
                    : unwrapMessageQrPayload(channelPayload)
            const rx = base64ToBytes(id.compactIdentity.x25519SecretKeyB64)
            const edB64 = contact.compactEd25519PublicKeyB64

            if (!edB64) {
                throw new Error("Contact missing compact Ed25519 public key")
            }

            const senderEd = base64ToBytes(edB64)
            return decryptCompactMessage(bytes, rx, senderEd)
        }

        const armored =
            typeof channelPayload === "string"
                ? channelPayload.trim()
                : await this.pgp.ciphertextToArmored(
                    unwrapMessageQrPayload(channelPayload),
                )
        const pk = contact.publicKeyArmored

        if (!pk) {
            throw new Error("Contact has no OpenPGP public key")
        }

        return this.pgp.decryptAndVerify(armored, pk)
    }

    public async normalizeInboundPayload(
        raw: VisitCardRawPayload,
    ): Promise<ScannedPayloadNormalized> {
        if (typeof raw === "string") {
            const t = raw.trim()

            if (t.startsWith("-----BEGIN PGP MESSAGE")) {
                return { channelStorage: t, cryptoProtocol: "openpgp" }
            }

            try {
                const b = base64ToBytes(t)

                if (b.byteLength > 0 && b[0] === COMPACT_MESSAGE_VERSION) {
                    return { channelStorage: t, cryptoProtocol: "compact_v1" }
                }
            } catch {
                /* not base64 */
            }

            throw new Error("Expected armored OpenPGP message or compact base64")
        }

        const inner = unwrapMessageQrPayload(raw)

        if (inner.byteLength > 0 && inner[0] === COMPACT_MESSAGE_VERSION) {
            return {
                channelStorage: bytesToBase64(inner),
                cryptoProtocol: "compact_v1",
            }
        }

        const armored = await this.pgp.ciphertextToArmored(inner)
        return { channelStorage: armored, cryptoProtocol: "openpgp" }
    }

    public async decryptOutboundSelf(
        channelPayload: string,
        messageProtocol: CryptoProtocolId,
    ): Promise<{ text: string; signaturesValid: boolean }> {
        const id = await this.requireIdentity()

        if (messageProtocol === "compact_v1") {
            if (!id.compactIdentity) {
                throw new Error("Compact identity not initialized")
            }

            const bytes = base64ToBytes(channelPayload.trim())
            const rx = base64ToBytes(id.compactIdentity.x25519SecretKeyB64)
            const selfEd = base64ToBytes(id.compactIdentity.ed25519PublicKeyB64)
            return decryptCompactMessage(bytes, rx, selfEd)
        }

        return this.pgp.decryptAndVerify(
            channelPayload.trim(),
            id.publicKeyArmored,
        )
    }
}
