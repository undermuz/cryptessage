export const IdentityService = Symbol.for("IdentityService")

export type IIdentityService = {
    /** Create OpenPGP identity if none exists (requires unlocked vault). */
    ensureIdentity(displayName: string): Promise<void>
    hasIdentity(): Promise<boolean>
    getPublicKeyArmored(): Promise<string>
    getFingerprintHex(): Promise<string>
    /** Primary user id string from the OpenPGP key (for visit cards / UI). */
    getSelfDisplayName(): Promise<string>
}
