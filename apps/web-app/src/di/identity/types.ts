export const IdentityService = Symbol.for("IdentityService")

export type IIdentityService = {
    /** Create OpenPGP identity if none exists (requires unlocked vault). */
    ensureIdentity(displayName: string): Promise<void>
    /** Ensure compact (NaCl) keys exist for `compact_v1`; no-op if already present. */
    ensureCompactIdentity(): Promise<void>
    hasIdentity(): Promise<boolean>
    getPublicKeyArmored(): Promise<string>
    getFingerprintHex(): Promise<string>
    /** Primary user id string from the OpenPGP key (for visit cards / UI). */
    getSelfDisplayName(): Promise<string>
    /** Binary compact visit card v1 (requires `ensureCompactIdentity`). */
    buildCompactVisitCard(displayName: string): Promise<Uint8Array>
}
