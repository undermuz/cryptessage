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
    /** OpenPGP armored ciphertext */
    armoredPayload: string
    createdAt: number
}

export type IdentityPlain = {
    publicKeyArmored: string
    privateKeyArmored: string
}
