export const PowSession = Symbol.for("@cryptessage/http-rest-v1:PowSession")

export type IPowSessionService = {
    /**
     * After successful PoW verification: register a new session and return `X-Cryptessage-Session` value.
     */
    issueAfterPow(): string
    /**
     * Validate session token, enforce idle + rate limits, return new header value or `null` if invalid.
     */
    rotateAfterSessionAuth(token: string): string | null
}
