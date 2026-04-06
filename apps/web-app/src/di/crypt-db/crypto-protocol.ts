export type CryptoProtocolId = "openpgp" | "compact_v1"

export const DEFAULT_CRYPTO_PROTOCOL: CryptoProtocolId = "openpgp"

export type VisitCardFormatPreference = CryptoProtocolId
