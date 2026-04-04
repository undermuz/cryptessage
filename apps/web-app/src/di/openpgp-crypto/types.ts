export const OpenPgpCryptoService = Symbol.for("OpenPgpCryptoService")

/** Raw visit card: legacy JSON / armored text, or binary `CMV2` QR payload. */
export type VisitCardRawPayload = string | Uint8Array

/** OpenPGP messaging + QR visit cards (ICryptoService from product spec). */
export type IOpenPgpCryptoService = {
    /** Legacy JSON `{v,n,k}` string for text interchange (paste, docs). */
    buildVisitCard(displayName: string): Promise<string>
    /** Compact binary visit card for QR (raw OpenPGP key packets, no ASCII armor). */
    buildVisitCardBinary(displayName: string): Promise<Uint8Array>
    parseVisitCard(
        raw: VisitCardRawPayload,
    ): Promise<{ displayName: string; publicKeyArmored: string }>
    /** Ensures armored text is a readable OpenPGP public key (throws with message). */
    validatePublicKeyArmored(armored: string): Promise<void>
    encryptAndSignForContact(
        plaintext: string,
        recipientPublicKeyArmored: string,
    ): Promise<string>
    /** Raw OpenPGP encrypted+signed message bytes (no ASCII armor). */
    encryptAndSignForContactBinary(
        plaintext: string,
        recipientPublicKeyArmored: string,
    ): Promise<Uint8Array>
    /** Single encrypt; armored for storage, binary for compact QR. */
    encryptAndSignForContactBundle(
        plaintext: string,
        recipientPublicKeyArmored: string,
    ): Promise<{ armored: string; binary: Uint8Array }>
    decryptAndVerify(
        ciphertext: string | Uint8Array,
        senderPublicKeyArmored: string,
    ): Promise<{ text: string; signaturesValid: boolean }>
    /** Normalize ciphertext (armored text or binary / message-QR wrapper) to armored PGP message for storage. */
    ciphertextToArmored(ciphertext: string | Uint8Array): Promise<string>
}
