/** IndexedDB database name */
export const CRYPT_DB_NAME = "cryptessage_v1"

/** Current IDB schema version */
export const CRYPT_DB_VERSION = 1

/**
 * PBKDF2-HMAC-SHA256 iterations for deriving the AES-GCM master key.
 * OWASP suggests large iteration counts for PBKDF2; adjust with perf testing.
 */
export const PBKDF2_ITERATIONS = 310_000

/**
 * Max payload bytes for a binary visit-card QR (EC-M, auto version).
 * Smaller than theoretical capacity; binary key avoids ASCII armor ~33% overhead.
 */
export const QR_VISIT_CARD_MAX_BYTES = 1500

/**
 * Max bytes for a binary message QR (`CMM1` + OpenPGP binary); larger than visit cards.
 */
export const QR_MESSAGE_MAX_BYTES = 4096

/**
 * Legacy cap for armored-only QR hint text (ASCII ~1 byte per char).
 */
export const QR_PAYLOAD_MAX_CHARS = 1200
