export const PowVerification = Symbol.for(
    "@cryptessage/http-rest-v1:PowVerification",
)

export type PowProofV1 = {
    algorithm: string
    nonce: string
    counter: string | number
}

export type IPowVerification = {
    parseHeader(headerValue: string | undefined): PowProofV1 | null
    verifyProof(
        proof: PowProofV1,
        deploymentSecret: string,
        difficultyBits: number,
    ): boolean
}
