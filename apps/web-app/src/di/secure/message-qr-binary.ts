/** Magic `CMM1` — cryptessage encrypted message QR (binary OpenPGP inside). */
export const MESSAGE_QR_MAGIC = new Uint8Array([
    0x43, 0x4d, 0x4d, 0x31,
]) /* CMM1 */
export const MESSAGE_QR_PAYLOAD_VERSION = 1

export function isMessageQrWrapper(bytes: Uint8Array): boolean {
    return (
        bytes.byteLength >= 4 &&
        bytes[0] === MESSAGE_QR_MAGIC[0] &&
        bytes[1] === MESSAGE_QR_MAGIC[1] &&
        bytes[2] === MESSAGE_QR_MAGIC[2] &&
        bytes[3] === MESSAGE_QR_MAGIC[3]
    )
}

/** Wrap raw OpenPGP encrypted binary for QR (scanner strips this shell). */
export function wrapOpenPgpBinaryForMessageQr(
    openpgpMessageBinary: Uint8Array,
): Uint8Array {
    const kl = openpgpMessageBinary.byteLength
    const out = new Uint8Array(4 + 1 + 4 + kl)
    let o = 0
    out.set(MESSAGE_QR_MAGIC, o)
    o += 4
    out[o++] = MESSAGE_QR_PAYLOAD_VERSION
    out[o++] = (kl >>> 24) & 0xff
    out[o++] = (kl >>> 16) & 0xff
    out[o++] = (kl >>> 8) & 0xff
    out[o++] = kl & 0xff
    out.set(openpgpMessageBinary, o)
    return out
}

export function unwrapOpenPgpBinaryFromMessageQr(bytes: Uint8Array): Uint8Array {
    if (!isMessageQrWrapper(bytes)) {
        return bytes
    }
    if (bytes.byteLength < 9) {
        throw new Error("Message QR payload is too short")
    }
    let o = 4
    const ver = bytes[o++]
    if (ver !== MESSAGE_QR_PAYLOAD_VERSION) {
        throw new Error(
            `Unsupported message QR version: ${ver} (expected ${MESSAGE_QR_PAYLOAD_VERSION})`,
        )
    }
    const keyLen =
        (bytes[o] << 24) |
        (bytes[o + 1] << 16) |
        (bytes[o + 2] << 8) |
        bytes[o + 3]
    o += 4
    if (keyLen < 1 || o + keyLen > bytes.byteLength) {
        throw new Error("Invalid message QR layout")
    }
    return bytes.subarray(o, o + keyLen)
}
