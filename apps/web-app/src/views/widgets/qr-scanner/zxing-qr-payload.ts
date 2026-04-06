import {
    type Result,
    ResultMetadataType,
} from "@zxing/library"

import { isCompactVisitCardV1 } from "@/di/compact-crypto/visit-card"
import {
    isCompactMessageQrWrapper,
    isMessageQrWrapper,
} from "@/di/secure/message-qr-binary"
import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"

/** Same as binary visit card magic in openpgp provider (`CMV2`). */
const CMV2 = [0x43, 0x4d, 0x56, 0x32] as const

function startsWithBinaryVisitMagic(bytes: Uint8Array): boolean {
    return (
        bytes.byteLength >= 4 &&
        bytes[0] === CMV2[0] &&
        bytes[1] === CMV2[1] &&
        bytes[2] === CMV2[2] &&
        bytes[3] === CMV2[3]
    )
}

/**
 * ZXing QR: logical payload bytes are in `BYTE_SEGMENTS`, not `getRawBytes()`.
 * Return concatenated segments when they start our cryptessage binary wrappers (`CMV2`, compact visit v1, `CMM1`, `CMK1`);
 * otherwise `getText()` (legacy mixed-mode JSON QRs and armored ASCII QRs).
 */
export function zxingCryptessagePayloadFromResult(
    result: Result,
): VisitCardRawPayload {
    const meta = result.getResultMetadata()
    const segments = meta?.get(
        ResultMetadataType.BYTE_SEGMENTS,
    ) as Uint8Array[] | undefined
    if (segments && segments.length > 0) {
        const total = segments.reduce((n, s) => n + s.byteLength, 0)
        const out = new Uint8Array(total)
        let o = 0
        for (const seg of segments) {
            out.set(seg, o)
            o += seg.byteLength
        }
        if (
            startsWithBinaryVisitMagic(out) ||
            isMessageQrWrapper(out) ||
            isCompactMessageQrWrapper(out) ||
            isCompactVisitCardV1(out)
        ) {
            return out
        }
    }
    return result.getText()
}
