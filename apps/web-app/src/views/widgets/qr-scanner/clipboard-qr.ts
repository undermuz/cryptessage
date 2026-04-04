import { BrowserQRCodeReader } from "@zxing/browser"

import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"
import { zxingCryptessagePayloadFromResult } from "@/views/widgets/qr-scanner/zxing-qr-payload"

export async function clipboardContainsImage(): Promise<boolean> {
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

export async function decodeQrFromClipboardImage(
    reader: BrowserQRCodeReader,
): Promise<VisitCardRawPayload | null> {
    if (!navigator.clipboard?.read) {
        return null
    }
    const items = await navigator.clipboard.read()
    for (const item of items) {
        const mime = item.types.find((t) => t.startsWith("image/"))
        if (!mime) {
            continue
        }
        const blob = await item.getType(mime)
        const bitmap = await createImageBitmap(blob)
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
    return null
}
