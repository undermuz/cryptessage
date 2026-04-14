import type { CompactIdentitySecrets } from "./model_compact_identity"

export type IdentityOpenPgp = {
    publicKeyArmored: string
    privateKeyArmored: string
}

export type IdentityPlain = {
    openpgp: IdentityOpenPgp
    compact?: CompactIdentitySecrets
}
