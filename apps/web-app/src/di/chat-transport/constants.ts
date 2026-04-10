/** Built-in offline QR/armored text channel (user-mediated). */
export const QR_TEXT_TRANSPORT_KIND = "qr_text"

/** HTTPS REST inbox transport (see docs/transports/http-rest-v1.md). */
export const HTTP_REST_V1_TRANSPORT_KIND = "http_rest_v1"

/**
 * Stable id for the built-in QR transport instance (not persisted in IDB).
 * Other instance ids MUST be random UUIDs.
 */
export const BUILTIN_QR_TEXT_INSTANCE_ID =
    "00000000-0000-4000-8000-000000000001"

export const TRANSPORT_PREFS_META_KEY = "transport_prefs_v1"
