export type ContactOpenPgpCrypto = {
    publicKeyArmored: string
}

export type ContactCompactCrypto = {
    x25519PublicKeyB64?: string
    ed25519PublicKeyB64?: string
}

export type ContactCrypto =
    | { protocol: "openpgp"; openpgp: ContactOpenPgpCrypto }
    | { protocol: "compact_v1"; compact: ContactCompactCrypto }

export type ContactTransport = {
    instanceOrder?: string[]
    preferredInstanceId?: string
    httpRestInboxRecipientKeyId?: string
}

export type ContactPlain = {
    id: string
    displayName: string
    createdAt: number
    crypto: ContactCrypto
    transport?: ContactTransport
}
