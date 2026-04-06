import type { CryptoProtocolId } from "@/di/crypt-db/crypto-protocol"

export const CryptoPrefsService = Symbol.for("CryptoPrefsService")

export type ICryptoPrefsService = {
    getDefaultVisitCardFormat(): Promise<CryptoProtocolId>
    setDefaultVisitCardFormat(protocol: CryptoProtocolId): Promise<void>
}
