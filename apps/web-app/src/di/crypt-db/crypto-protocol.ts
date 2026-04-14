export type CryptoProtocolId = "openpgp" | "compact_v1"

export const DEFAULT_CRYPTO_PROTOCOL: CryptoProtocolId = "compact_v1"

export type VisitCardFormatPreference = CryptoProtocolId
