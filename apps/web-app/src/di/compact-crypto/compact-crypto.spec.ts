import { describe, expect, it } from "vitest"
import { ed25519, x25519 } from "@noble/curves/ed25519"

import {
    decryptCompactMessage,
    encryptCompactMessage,
} from "./compact-message"
import { decodeVisitCardV1, encodeVisitCardV1 } from "./visit-card"

describe("compact visit card v1", () => {
    it("roundtrips name and keys", () => {
        const xPub = new Uint8Array(32).fill(3)
        const edPub = new Uint8Array(32).fill(7)
        const enc = encodeVisitCardV1("Alice", xPub, edPub)
        const dec = decodeVisitCardV1(enc)
        expect(dec.displayName).toBe("Alice")
        expect(dec.x25519PublicKey).toEqual(xPub)
        expect(dec.ed25519PublicKey).toEqual(edPub)
    })
})

describe("compact message v1", () => {
    it("roundtrips and verifies signature", () => {
        const recipientSec = x25519.utils.randomSecretKey()
        const recipientPub = x25519.getPublicKey(recipientSec)
        const senderSec = x25519.utils.randomSecretKey()
        const senderEdSec = ed25519.utils.randomSecretKey()
        const senderEdPub = ed25519.getPublicKey(senderEdSec)
        const plain = "Hello compact ü"
        const packet = encryptCompactMessage(
            plain,
            recipientPub,
            senderSec,
            senderEdSec,
        )
        const out = decryptCompactMessage(
            packet,
            recipientSec,
            senderEdPub,
        )
        expect(out.text).toBe(plain)
        expect(out.signaturesValid).toBe(true)
    })

    it("fails with wrong recipient secret", () => {
        const recipientSec = x25519.utils.randomSecretKey()
        const recipientPub = x25519.getPublicKey(recipientSec)
        const wrongSec = x25519.utils.randomSecretKey()
        const senderSec = x25519.utils.randomSecretKey()
        const senderEdSec = ed25519.utils.randomSecretKey()
        const senderEdPub = ed25519.getPublicKey(senderEdSec)
        const packet = encryptCompactMessage(
            "x",
            recipientPub,
            senderSec,
            senderEdSec,
        )
        expect(() =>
            decryptCompactMessage(packet, wrongSec, senderEdPub),
        ).toThrow()
    })
})
