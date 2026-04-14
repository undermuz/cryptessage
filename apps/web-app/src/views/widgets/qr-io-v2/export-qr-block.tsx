import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { Button, Disclosure, Surface, TextArea } from "@heroui/react"
import { Copy } from "lucide-react"

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
    heading?: string
    labels: ExportQrLabels
    expanded: boolean
    onExpandedChange?: (next: boolean) => void
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
    const [armoredExpanded, setArmoredExpanded] = useState(false)

    useEffect(() => {
        if (!showArmoredPreview) {
            setArmoredExpanded(false)
        }
    }, [showArmoredPreview])

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

    const showQrSection = expanded && (qrPayload || payloadLoading)

    const armoredValue = useMemo(() => armoredStr.trim(), [armoredStr])

    return (
        <Surface
            className="flex flex-col gap-4 rounded-3xl p-4"
            variant="default"
        >
            {heading ? (
                <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                        <h2 className="text-sm font-semibold">{heading}</h2>
                    </div>
                    {onExpandedChange ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onPress={() => onExpandedChange(!expanded)}
                        >
                            {expanded ? labels.hideQr : labels.showQr}
                        </Button>
                    ) : null}
                </div>
            ) : null}

            {showQrSection && (
                <div className="space-y-3">
                    {payloadLoading && !qrPayload && (
                        <p className="text-sm text-default-500">…</p>
                    )}
                    {qrPayload && (
                        <>
                            <div className="flex justify-center rounded-2xl bg-default-100 p-3">
                                <VisitQrCanvas
                                    ref={canvasRef}
                                    payload={qrPayload}
                                    maxByteLength={maxByteLength}
                                    onDrawComplete={() => setQrReady(true)}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    isDisabled={!qrReady}
                                    onPress={() => shareQrImage()}
                                >
                                    {labels.shareQr}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    isDisabled={!qrReady}
                                    onPress={() => copyQrImage()}
                                >
                                    {labels.copyQrImage}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {showArmoredPreview && armoredValue && (
                <Disclosure
                    isExpanded={armoredExpanded}
                    onExpandedChange={setArmoredExpanded}
                >
                    <Disclosure.Heading>
                        <Button slot="trigger" variant="secondary" size="sm">
                            {labels.copyArmored}
                            <Disclosure.Indicator />
                        </Button>
                    </Disclosure.Heading>
                    <Disclosure.Content>
                        <Disclosure.Body className="mt-3">
                            <div className="relative">
                                <TextArea
                                    aria-label={labels.copyArmored}
                                    readOnly
                                    value={armoredStr}
                                    variant="secondary"
                                    className="min-h-[120px] font-mono text-xs pr-12 w-full"
                                />
                                <div className="absolute right-2 top-2">
                                    <Button
                                        isIconOnly
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        isDisabled={!armoredValue}
                                        onPress={() => void copyArmored()}
                                        aria-label={labels.copyArmored}
                                    >
                                        <Copy className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </Disclosure.Body>
                    </Disclosure.Content>
                </Disclosure>
            )}

            {footer ? <div>{footer}</div> : null}
            {oversizeWarning && oversizeMessage}
        </Surface>
    )
}
