import { BrowserQRCodeReader } from "@zxing/browser"

import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"
import { zxingCryptessagePayloadFromResult } from "@/views/widgets/qr-scanner/zxing-qr-payload"

/** iPad / iPhone / iPod; includes iPadOS desktop UA. */
export function isIosLikeDevice(): boolean {
    if (typeof navigator === "undefined") {
        return false
    }
    return (
        /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    )
}

/**
 * Safari (especially iOS) only allows `clipboard.read()` in a direct user gesture;
 * background polling always fails and would keep “Paste QR” disabled forever.
 */
export function clipboardAsyncReadPollWorks(): boolean {
    return Boolean(navigator.clipboard?.read) && !isIosLikeDevice()
}

export async function clipboardContainsImage(): Promise<boolean> {
    if (!clipboardAsyncReadPollWorks()) {
        return false
    }
    if (!navigator.clipboard?.read) {
        return false
    }
    try {
        const items = await navigator.clipboard.read()
        for (const item of items) {
            if (item.types.some((t) => t.startsWith("image/"))) {
                return true
            }
        }
    } catch {
        /* no permission or unsupported */
    }
    return false
}

export async function decodeQrFromImageBlob(
    reader: BrowserQRCodeReader,
    blob: Blob,
): Promise<VisitCardRawPayload | null> {
    let bitmap: ImageBitmap | undefined
    try {
        bitmap = await createImageBitmap(blob)
    } catch {
        return null
    }
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext("2d")
    if (!ctx) {
        bitmap.close()
        return null
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    try {
        const result = reader.decodeFromCanvas(canvas)
        const payload = zxingCryptessagePayloadFromResult(result)
        if (
            typeof payload === "string"
                ? payload.length > 0
                : payload.byteLength > 0
        ) {
            return payload
        }
        return null
    } catch {
        return null
    }
}

export async function decodeQrFromClipboardImage(
    reader: BrowserQRCodeReader,
): Promise<VisitCardRawPayload | null> {
    if (!navigator.clipboard?.read) {
        return null
    }
    try {
        const items = await navigator.clipboard.read()
        for (const item of items) {
            const mime = item.types.find((t) => t.startsWith("image/"))
            if (!mime) {
                continue
            }
            const blob = await item.getType(mime)
            const payload = await decodeQrFromImageBlob(reader, blob)
            if (payload) {
                return payload
            }
        }
    } catch {
        return null
    }
    return null
}
