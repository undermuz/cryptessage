import { createHash } from "node:crypto"
import { injectable } from "inversify"

import type { IPowVerification, PowProofV1 } from "./types.js"

@injectable()
export class PowVerificationProvider implements IPowVerification {
    private base64UrlToBytes(s: string): Buffer {
        let b64 = s.replace(/-/g, "+").replace(/_/g, "/")
        const pad = b64.length % 4

        if (pad) {
            b64 += "=".repeat(4 - pad)
        }

        return Buffer.from(b64, "base64")
    }

    private countLeadingZeroBits(digest: Uint8Array): number {
        let bits = 0

        for (let i = 0; i < digest.byteLength; i++) {
            const b = digest[i]!

            if (b === 0) {
                bits += 8

                continue
            }

            for (let j = 7; j >= 0; j--) {
                if ((b >> j) & 1) {
                    return bits
                }

                bits++
            }

            return bits
        }

        return bits
    }

    public verifyProof(
        proof: PowProofV1,
        deploymentSecret: string,
        difficultyBits: number,
    ): boolean {
        if (proof.algorithm !== "sha256-pow-v1") {
            return false
        }

        let nonceBytes: Buffer

        try {
            nonceBytes = this.base64UrlToBytes(proof.nonce)
        } catch {
            return false
        }

        const counterRaw = proof.counter
        const counterStr =
            typeof counterRaw === "number" ? String(counterRaw) : counterRaw

        if (!/^\d+$/.test(counterStr)) {
            return false
        }

        let counter: bigint

        try {
            counter = BigInt(counterStr)
        } catch {
            return false
        }

        if (counter < 0n || counter > 0xffffffffffffffffn) {
            return false
        }

        const secretBytes = Buffer.from(deploymentSecret, "utf8")
        const counterBuf = Buffer.allocUnsafe(8)

        counterBuf.writeBigUInt64BE(counter, 0)

        const input = Buffer.concat([nonceBytes, secretBytes, counterBuf])
        const digest = createHash("sha256").update(input).digest()

        return this.countLeadingZeroBits(digest) >= difficultyBits
    }

    public parseHeader(headerValue: string | undefined): PowProofV1 | null {
        if (!headerValue || !headerValue.trim()) {
            return null
        }

        let b64 = headerValue.trim()
        let buf: Buffer

        try {
            let normalized = b64.replace(/-/g, "+").replace(/_/g, "/")
            const pad = normalized.length % 4

            if (pad) {
                normalized += "=".repeat(4 - pad)
            }

            buf = Buffer.from(normalized, "base64")
        } catch {
            return null
        }

        let text: string

        try {
            text = buf.toString("utf8")
        } catch {
            return null
        }

        try {
            const o = JSON.parse(text) as unknown

            if (
                typeof o !== "object" ||
                o === null ||
                !("algorithm" in o) ||
                !("nonce" in o) ||
                !("counter" in o)
            ) {
                return null
            }

            const p = o as Record<string, unknown>
            const algorithm = p.algorithm
            const nonce = p.nonce
            const counter = p.counter

            if (typeof algorithm !== "string" || typeof nonce !== "string") {
                return null
            }

            if (typeof counter !== "string" && typeof counter !== "number") {
                return null
            }

            return { algorithm, nonce, counter }
        } catch {
            return null
        }
    }
}
