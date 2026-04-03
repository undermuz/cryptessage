export const OpenPgpCryptoService = Symbol.for("OpenPgpCryptoService")

/** OpenPGP messaging + QR visit cards (ICryptoService from product spec). */
export type IOpenPgpCryptoService = {
    buildVisitCard(displayName: string): Promise<string>
    parseVisitCard(raw: string): { displayName: string; publicKeyArmored: string }
    /** Ensures armored text is a readable OpenPGP public key (throws with message). */
    validatePublicKeyArmored(armored: string): Promise<void>
    encryptAndSignForContact(
        plaintext: string,
        recipientPublicKeyArmored: string,
    ): Promise<string>
    decryptAndVerify(
        armoredMessage: string,
        senderPublicKeyArmored: string,
    ): Promise<{ text: string; signaturesValid: boolean }>
}
