/** Binary visit card (handshake) — version field. */
export const COMPACT_VISIT_CARD_VERSION = 0x01

/** Binary encrypted message — version field. */
export const COMPACT_MESSAGE_VERSION = 0x02

export const COMPACT_KEY_LEN = 32

export const COMPACT_ED25519_SIG_LEN = 64

/** v0x01 minimum: ver + x_pk + ed_pk + nameLen + empty name */
export const COMPACT_VISIT_MIN_LEN =
    1 + COMPACT_KEY_LEN + COMPACT_KEY_LEN + 1
