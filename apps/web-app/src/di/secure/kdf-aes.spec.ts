import { describe, expect, it } from "vitest"

import { aesGcmEncrypt, decryptUtf8 } from "./aes-gcm"
import { deriveAesGcmKey } from "./kdf"

describe("deriveAesGcmKey + AES-GCM", () => {
    it("roundtrips UTF-8 plaintext", async () => {
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const key = await deriveAesGcmKey("test-passphrase-ü", salt)
        const blob = await aesGcmEncrypt(
            key,
            new TextEncoder().encode('{"x":1,"note":"привет"}'),
        )
        const out = await decryptUtf8(key, blob)

        expect(JSON.parse(out)).toEqual({ x: 1, note: "привет" })
    })
})
