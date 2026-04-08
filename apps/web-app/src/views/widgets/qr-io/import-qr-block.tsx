import { useRef, useState, type ChangeEvent, type ReactNode } from "react"

import { Button } from "@/views/ui/button"
import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"
import { QrScannerPanel } from "@/views/widgets/qr-scanner"

export type ImportQrI18n = {
    heading: string
    scan: string
    pasteFromImage: string
    /** Label while `pasteBusy` after user clicked Paste (clipboard read + decode). */
    pasteFromImagePending?: string
    /** Shown when `onPickQrImageFile` is set (e.g. iOS fallback). */
    pickQrImage?: string
    armoredSectionTitle: string
    armoredSubmit: string
    armoredPlaceholder: string
}

type Props = {
    i18n: ImportQrI18n
    armored: {
        value: string
        onChange: (value: string) => void
        onSubmit: () => void
    }
    isProcessing: boolean
    onPasteQrFromImage: () => void
    /** iOS-friendly: decode QR from a photo / screenshot file. */
    onPickQrImageFile?: (file: File) => void
    onScannedPayload: (payload: VisitCardRawPayload) => void
    /** Render when user has scanned/pasted a QR (preview + actions). */
    children?: ReactNode
    /** Optional field between QR preview and armored paste (e.g. name override). */
    nameHint?: {
        label: string
        value: string
        onChange: (value: string) => void
    }
}

export function ImportQrBlock({
    i18n,
    armored,
    isProcessing,
    onPasteQrFromImage,
    onPickQrImageFile,
    onScannedPayload,
    children,
    nameHint,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [scanOpen, setScanOpen] = useState(false)
    const armoredSubmitDisabled = !armored.value.trim()

    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]

        e.target.value = ""

        if (file && onPickQrImageFile) {
            onPickQrImageFile(file)
        }
    }

    return (
        <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-medium">{i18n.heading}</h2>

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    disabled={scanOpen}
                    onClick={() => setScanOpen(true)}
                >
                    {i18n.scan}
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    disabled={scanOpen || isProcessing}
                    onClick={() => void onPasteQrFromImage()}
                >
                    {isProcessing
                        ? (i18n.pasteFromImagePending ??
                          `${i18n.pasteFromImage}…`)
                        : i18n.pasteFromImage}
                </Button>

                {onPickQrImageFile && i18n.pickQrImage && (
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
                            disabled={scanOpen || isProcessing}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {i18n.pickQrImage}
                        </Button>
                    </>
                )}
            </div>

            {scanOpen && (
                <QrScannerPanel
                    onResult={(payload) => {
                        setScanOpen(false)
                        onScannedPayload(payload)
                    }}
                    onClose={() => setScanOpen(false)}
                />
            )}

            {children}

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
                    {i18n.armoredSectionTitle}
                </h3>

                <textarea
                    className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
                    value={armored.value}
                    placeholder={i18n.armoredPlaceholder}
                    onChange={(e) => armored.onChange(e.target.value)}
                    spellCheck={false}
                />

                <Button
                    type="button"
                    disabled={armoredSubmitDisabled}
                    onClick={() => armored.onSubmit()}
                >
                    {i18n.armoredSubmit}
                </Button>
            </div>
        </section>
    )
}
