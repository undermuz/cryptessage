export const ChallengeStore = Symbol.for(
    "@cryptessage/http-rest-v1:ChallengeStore",
)

export type StoredChallenge = {
    difficultyBits: number
    expiresAtMs: number
}

export type IChallengeStore = {
    rememberChallenge(
        nonce: string,
        difficultyBits: number,
        expiresAtIso: string,
    ): void
    takeChallenge(nonce: string): StoredChallenge | null
}
