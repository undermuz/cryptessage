import { bytesToBase64, base64ToBytes } from "./encoding"

export type EncryptedBlob = {
    ivB64: string
    ciphertextB64: string
}

export async function aesGcmEncrypt(
    key: CryptoKey,
    plaintext: Uint8Array,
): Promise<EncryptedBlob> {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ct = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv as BufferSource },
            key,
            plaintext as BufferSource,
        ),
    )

    return {
        ivB64: bytesToBase64(iv),
        ciphertextB64: bytesToBase64(ct),
    }
}

export async function aesGcmDecrypt(
    key: CryptoKey,
    blob: EncryptedBlob,
): Promise<Uint8Array> {
    const iv = base64ToBytes(blob.ivB64)
    const ciphertext = base64ToBytes(blob.ciphertextB64)

    return new Uint8Array(
        await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv as BufferSource },
            key,
            ciphertext as BufferSource,
        ),
    )
}

export async function encryptUtf8(
    key: CryptoKey,
    text: string,
): Promise<EncryptedBlob> {
    return aesGcmEncrypt(key, new TextEncoder().encode(text))
}

export async function decryptUtf8(
    key: CryptoKey,
    blob: EncryptedBlob,
): Promise<string> {
    return new TextDecoder().decode(await aesGcmDecrypt(key, blob))
}
