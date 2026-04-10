import { base64ToBytes, bytesToBase64 } from "@/di/secure/encoding"

import type { PowChallenge } from "./types"

function base64UrlToBytes(s: string): Uint8Array {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/")
    const pad = b64.length % 4

    if (pad) {
        b64 += "=".repeat(4 - pad)
    }

    return base64ToBytes(b64)
}

function utf8(s: string): Uint8Array {
    return new TextEncoder().encode(s)
}

function concat(chunks: Uint8Array[]): Uint8Array {
    const total = chunks.reduce((n, c) => n + c.byteLength, 0)
    const out = new Uint8Array(total)
    let o = 0

    for (const c of chunks) {
        out.set(c, o)
        o += c.byteLength
    }

    return out
}

function u64BigEndian(counter: bigint): Uint8Array {
    const buf = new ArrayBuffer(8)
    const view = new DataView(buf)

    view.setBigUint64(0, counter, false)

    return new Uint8Array(buf)
}

function countLeadingZeroBits(digest: Uint8Array): number {
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

async function sha256(data: Uint8Array): Promise<Uint8Array> {
    const buf = await crypto.subtle.digest("SHA-256", data as BufferSource)

    return new Uint8Array(buf)
}

/**
 * Per docs/transports/security.md: SHA256(nonceBytes ‖ utf8(deploymentSecret) ‖ u64be(counter)).
 * `nonce` from challenge is base64url-decoded to bytes.
 * @returns The first `counter` whose hash meets `challenge.difficultyBits`.
 * @throws On wrong algorithm, bad nonce, expired challenge (caller should check), or exhausted counter range.
 */
export async function solveSha256PowV1(
    challenge: PowChallenge,
    deploymentSecret: string,
): Promise<{ counter: bigint }> {
    if (challenge.algorithm !== "sha256-pow-v1") {
        throw new Error(`PoW: unsupported algorithm ${challenge.algorithm}`)
    }

    let nonceBytes: Uint8Array

    try {
        nonceBytes = base64UrlToBytes(challenge.nonce)
    } catch {
        throw new Error("PoW: invalid challenge nonce (expected base64url)")
    }

    const secretBytes = utf8(deploymentSecret)
    const need = challenge.difficultyBits
    let counter = 0n

    while (counter < 0xffffffffffffffffn) {
        const input = concat([
            nonceBytes,
            secretBytes,
            u64BigEndian(counter),
        ])
        const digest = await sha256(input)

        if (countLeadingZeroBits(digest) >= need) {
            return { counter }
        }

        counter += 1n
    }

    throw new Error("PoW: counter exhausted")
}

/**
 * Serializes a PoW proof object to base64url JSON for the `X-Cryptessage-Pow` header.
 */
export function encodePowProofHeader(proof: {
    algorithm: "sha256-pow-v1"
    nonce: string
    counter: string
}): string {
    const json = JSON.stringify(proof)
    const bytes = utf8(json)

    return bytesToBase64(bytes)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
}

/**
 * Builds the `X-Cryptessage-Pow` header value from a solved `counter` for the given challenge.
 */
export function buildPowProofFromChallenge(
    challenge: PowChallenge,
    counter: bigint,
): string {
    return encodePowProofHeader({
        algorithm: "sha256-pow-v1",
        nonce: challenge.nonce,
        counter: counter.toString(),
    })
}
