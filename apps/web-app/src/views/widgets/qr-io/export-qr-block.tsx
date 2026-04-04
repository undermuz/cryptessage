import { useEffect, useRef, useState, type ReactNode } from "react"

import { Button } from "@/views/ui/button"
import { VisitQrCanvas } from "@/views/widgets/visit-qr"

export type ExportQrLabels = {
    showQr: string
    hideQr: string
    copyQrImage: string
    shareQr: string
    copyArmored: string
    copyQrUnavailable: string
    copyQrFail: (reason: string) => string
    copyQrOk: string
    copyArmoredOk: string
    shareUnavailable: string
    shareFail: (reason: string) => string
}

type Props = {
    heading: string
    labels: ExportQrLabels
    expanded: boolean
    onExpandedChange: (next: boolean) => void
    /** When expanded and still fetching payload */
    payloadLoading?: boolean
    qrPayload: string | Uint8Array | null
    maxByteLength: number
    armoredText: string
    onNotify: (message: string | null) => void
    /** Optional note under actions (limits, hints). */
    footer?: ReactNode
    oversizeWarning?: boolean
    oversizeMessage?: ReactNode
    shareFileName?: string
    shareTitle?: string
    /** Show armored block + pre (e.g. chat ciphertext). */
    showArmoredPreview?: boolean
}

export function ExportQrBlock({
    heading,
    labels,
    expanded,
    onExpandedChange,
    payloadLoading = false,
    qrPayload,
    maxByteLength,
    armoredText,
    onNotify,
    footer,
    oversizeWarning = false,
    oversizeMessage,
    shareFileName = "cryptessage-qr.png",
    shareTitle = "cryptessage",
    showArmoredPreview = false,
}: Props) {
    const armoredStr =
        typeof armoredText === "string"
            ? armoredText
            : armoredText == null
              ? ""
              : String(armoredText)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [qrReady, setQrReady] = useState(false)

    useEffect(() => {
        setQrReady(false)
    }, [qrPayload])

    useEffect(() => {
        if (!expanded) {
            setQrReady(false)
        }
    }, [expanded])

    const copyQrImage = () => {
        const canvas = canvasRef.current
        if (!canvas || !qrReady) {
            onNotify(labels.copyQrUnavailable)
            return
        }
        onNotify(null)
        canvas.toBlob(async (blob) => {
            if (!blob || !navigator.clipboard?.write) {
                onNotify(labels.copyQrFail("clipboard"))
                return
            }
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": blob }),
                ])
                onNotify(labels.copyQrOk)
            } catch (e) {
                const reason = e instanceof Error ? e.message : String(e)
                onNotify(labels.copyQrFail(reason))
            }
        }, "image/png")
    }

    const shareQrImage = () => {
        const canvas = canvasRef.current
        if (!canvas || !qrReady) {
            onNotify(labels.shareUnavailable)
            return
        }
        onNotify(null)
        canvas.toBlob(async (blob) => {
            if (!blob) {
                onNotify(labels.shareFail("empty image"))
                return
            }
            const file = new File([blob], shareFileName, { type: "image/png" })
            if (!navigator.share) {
                onNotify(labels.shareUnavailable)
                return
            }
            if (
                typeof navigator.canShare === "function" &&
                !navigator.canShare({ files: [file] })
            ) {
                onNotify(labels.shareUnavailable)
                return
            }
            try {
                await navigator.share({
                    files: [file],
                    title: shareTitle,
                })
            } catch (e) {
                if (e instanceof Error && e.name === "AbortError") {
                    return
                }
                const reason = e instanceof Error ? e.message : String(e)
                onNotify(labels.shareFail(reason))
            }
        }, "image/png")
    }

    const copyArmored = async () => {
        onNotify(null)
        try {
            await navigator.clipboard.writeText(armoredStr)
            onNotify(labels.copyArmoredOk)
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)
            onNotify(labels.copyQrFail(reason))
        }
    }

    return (
        <section className="space-y-2 rounded-lg border border-border p-4">
            <h2 className="text-sm font-medium">{heading}</h2>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onExpandedChange(!expanded)}
            >
                {expanded ? labels.hideQr : labels.showQr}
            </Button>
            {expanded && (qrPayload || payloadLoading) && (
                <div className="mt-2 space-y-2">
                    {payloadLoading && !qrPayload && (
                        <p className="text-sm text-muted-foreground">…</p>
                    )}
                    {qrPayload && (
                        <>
                            <VisitQrCanvas
                                ref={canvasRef}
                                payload={qrPayload}
                                maxByteLength={maxByteLength}
                                onDrawComplete={() => setQrReady(true)}
                            />
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={!qrReady}
                                    onClick={() => copyQrImage()}
                                >
                                    {labels.copyQrImage}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={!qrReady}
                                    onClick={() => shareQrImage()}
                                >
                                    {labels.shareQr}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}
            {qrPayload && (
                <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!armoredStr.trim()}
                            onClick={() => void copyArmored()}
                        >
                            {labels.copyArmored}
                        </Button>
                    </div>
                    {showArmoredPreview && armoredStr.trim() && (
                        <div className="space-y-1">
                            <label className="block text-xs font-medium text-muted-foreground">
                                {labels.copyArmored}
                            </label>
                            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
                                {armoredStr}
                            </pre>
                        </div>
                    )}
                    {footer}
                    {oversizeWarning && oversizeMessage}
                </div>
            )}
        </section>
    )
}
