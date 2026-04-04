export type ContactPlain = {
    id: string
    displayName: string
    publicKeyArmored: string
    createdAt: number
}

export type MessageDirection = "in" | "out"

export type MessagePlain = {
    id: string
    contactId: string
    direction: MessageDirection
    /** OpenPGP armored ciphertext for the contact (QR / channel). */
    armoredPayload: string
    createdAt: number
    /**
     * For `out` only: same plaintext encrypted to this device's OpenPGP public key
     * and signed with the private key — for history display without storing plaintext.
     */
    outboundSelfArmored?: string
}

export type IdentityPlain = {
    publicKeyArmored: string
    privateKeyArmored: string
}
