import { useRef, type ChangeEvent, type ReactNode } from "react"

import { Button } from "@/views/ui/button"
import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"
import { QrScannerPanel } from "@/views/widgets/qr-scanner"

export type ImportQrLabels = {
    scan: string
    pasteFromImage: string
    /** Shown when `onPickQrImageFile` is set (e.g. iOS fallback). */
    pickQrImage?: string
    armoredSectionTitle: string
    armoredSubmit: string
}

type Props = {
    heading: string
    labels: ImportQrLabels
    armoredPlaceholder: string
    armoredValue: string
    onArmoredChange: (value: string) => void
    onArmoredSubmit: () => void
    armoredSubmitDisabled?: boolean
    hasClipboardImage: boolean
    pasteBusy: boolean
    scanOpen: boolean
    onOpenScan: () => void
    onCloseScan: () => void
    onPasteQrFromImage: () => void
    /** iOS-friendly: decode QR from a photo / screenshot file. */
    onPickQrImageFile?: (file: File) => void
    onScannedPayload: (payload: VisitCardRawPayload) => void
    /** Render when user has scanned/pasted a QR (preview + actions). */
    preview?: ReactNode
    /** Optional field between QR preview and armored paste (e.g. name override). */
    nameHint?: {
        label: string
        value: string
        onChange: (value: string) => void
    }
}

export function ImportQrBlock({
    heading,
    labels,
    armoredPlaceholder,
    armoredValue,
    onArmoredChange,
    onArmoredSubmit,
    armoredSubmitDisabled = false,
    hasClipboardImage,
    pasteBusy,
    scanOpen,
    onOpenScan,
    onCloseScan,
    onPasteQrFromImage,
    onPickQrImageFile,
    onScannedPayload,
    preview,
    nameHint,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (file && onPickQrImageFile) {
            onPickQrImageFile(file)
        }
    }

    return (
        <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-medium">{heading}</h2>
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    disabled={scanOpen}
                    onClick={() => onOpenScan()}
                >
                    {labels.scan}
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={scanOpen || !hasClipboardImage || pasteBusy}
                    onClick={() => void onPasteQrFromImage()}
                >
                    {labels.pasteFromImage}
                </Button>
                {onPickQrImageFile && labels.pickQrImage && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={onFileChange}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            disabled={scanOpen || pasteBusy}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {labels.pickQrImage}
                        </Button>
                    </>
                )}
            </div>
            {scanOpen && (
                <QrScannerPanel
                    onResult={(payload) => {
                        onCloseScan()
                        onScannedPayload(payload)
                    }}
                    onClose={() => onCloseScan()}
                />
            )}
            {preview}
            {nameHint && (
                <label className="block text-xs text-muted-foreground">
                    {nameHint.label}
                    <input
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        value={nameHint.value}
                        onChange={(e) => nameHint.onChange(e.target.value)}
                    />
                </label>
            )}
            <div className="space-y-2 border-t border-border pt-3">
                <h3 className="text-xs font-medium text-muted-foreground">
                    {labels.armoredSectionTitle}
                </h3>
                <textarea
                    className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
                    value={armoredValue}
                    placeholder={armoredPlaceholder}
                    onChange={(e) => onArmoredChange(e.target.value)}
                    spellCheck={false}
                />
                <Button
                    type="button"
                    disabled={armoredSubmitDisabled}
                    onClick={() => onArmoredSubmit()}
                >
                    {labels.armoredSubmit}
                </Button>
            </div>
        </section>
    )
}
