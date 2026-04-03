import { describe, expect, it } from "vitest"

import {
    decryptPlainPayload,
    encryptPlainPayload,
    parseBackupFile,
    serializeBackupFile,
    type BackupFileV1,
} from "./backup-format"
import { deriveAesGcmKey } from "./kdf"

describe("backup-format", () => {
    it("parseBackupFile rejects invalid JSON shape", () => {
        expect(() => parseBackupFile("{}")).toThrow("Invalid backup file")
    })

    it("serialize and parse BackupFileV1", () => {
        const f: BackupFileV1 = {
            format: 1,
            saltB64: "AA",
            ivB64: "BB",
            ciphertextB64: "CC",
        }
        expect(parseBackupFile(serializeBackupFile(f))).toEqual(f)
    })

    it("encryptPlainPayload roundtrip", async () => {
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const key = await deriveAesGcmKey("backup-pass", salt)
        const plain = {
            contacts: [],
            messages: [],
            identity: {
                publicKeyArmored: "pub",
                privateKeyArmored: "priv",
            },
        }
        const blob = await encryptPlainPayload(key, plain)
        const back = await decryptPlainPayload(key, blob)
        expect(back).toEqual(plain)
    })
})
