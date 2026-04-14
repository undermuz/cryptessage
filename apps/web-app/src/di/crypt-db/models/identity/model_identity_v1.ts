import type { CompactIdentitySecrets } from "./model_compact_identity"

/** Flat identity as stored before plain-model step 1 →2. */
export type IdentityPlainV1 = {
    publicKeyArmored: string
    privateKeyArmored: string
    /** NaCl-style compact keys for `compact_v1`. */
    compactIdentity?: CompactIdentitySecrets
}
