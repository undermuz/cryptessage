/** IndexedDB database name */
export const CRYPT_DB_NAME = "cryptessage_v1"

/** Current IDB schema version */
export const CRYPT_DB_VERSION = 1

/**
 * PBKDF2-HMAC-SHA256 iterations for deriving the AES-GCM master key.
 * OWASP suggests large iteration counts for PBKDF2; adjust with perf testing.
 */
export const PBKDF2_ITERATIONS = 310_000

/** Max recommended UTF-8 length for a single QR payload (version-dependent; safe default). */
export const QR_PAYLOAD_MAX_CHARS = 1200
