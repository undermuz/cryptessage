import { useRef, useState, type ChangeEvent, type ReactNode } from "react"

import { Button, Disclosure, Input, TextArea } from "@heroui/react"

import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"
import { QrScannerPanel } from "@/views/widgets/qr-scanner"

export type ImportQrI18n = {
    heading?: string
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
    /** Where to render `children` (preview). Default: bottom. */
    childrenPlacement?: "top" | "bottom"
    /** Optional field between QR preview and armored paste (e.g. name override). */
    nameHint?: {
        label: string
        value: string
        onChange: (value: string) => void
    }
    /** Hide armored textarea behind a disclosure trigger button. */
    armoredDisclosure?: {
        defaultExpanded?: boolean
        triggerLabel?: string
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
    childrenPlacement = "bottom",
    nameHint,
    armoredDisclosure,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [scanOpen, setScanOpen] = useState(false)
    const armoredSubmitDisabled = !armored.value.trim()
    const [armoredExpanded, setArmoredExpanded] = useState(
        armoredDisclosure?.defaultExpanded ?? false,
    )

    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]

        e.target.value = ""

        if (file && onPickQrImageFile) {
            onPickQrImageFile(file)
        }
    }

    const header = i18n.heading ? (
        <h2 className="text-sm font-semibold">{i18n.heading}</h2>
    ) : null

    const previewTop = childrenPlacement === "top" ? children : null
    const previewBottom = childrenPlacement === "bottom" ? children : null

    const armoredPanel = (
        <div className="space-y-3 border-t border-divider pt-4">
            <h3 className="text-xs font-medium text-default-500">
                {i18n.armoredSectionTitle}
            </h3>

            <TextArea
                value={armored.value}
                placeholder={i18n.armoredPlaceholder}
                onChange={(e) => armored.onChange(e.target.value)}
                variant="secondary"
                className="w-full min-h-[120px] font-mono text-xs"
            />

            <div className="flex justify-end pt-1">
                <Button
                    type="button"
                    size="sm"
                    isDisabled={armoredSubmitDisabled}
                    onPress={() => armored.onSubmit()}
                >
                    {i18n.armoredSubmit}
                </Button>
            </div>
        </div>
    )

    return (
        <section className="space-y-3 rounded-large border border-divider bg-default-50 p-4 shadow-sm">
            {header}

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    isDisabled={scanOpen}
                    onPress={() => setScanOpen(true)}
                >
                    {i18n.scan}
                </Button>

                <Button
                    type="button"
                    variant="secondary"
                    isDisabled={scanOpen || isProcessing}
                    onPress={() => void onPasteQrFromImage()}
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
                            isDisabled={scanOpen || isProcessing}
                            onPress={() => fileInputRef.current?.click()}
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

            {previewTop}

            {nameHint && (
                <div className="space-y-1">
                    <label className="block text-xs text-default-500">
                        {nameHint.label}
                    </label>
                    <Input
                        value={nameHint.value}
                        onChange={(e) => nameHint.onChange(e.target.value)}
                        variant="secondary"
                    />
                </div>
            )}

            {armoredDisclosure ? (
                <Disclosure
                    isExpanded={armoredExpanded}
                    onExpandedChange={setArmoredExpanded}
                >
                    <Disclosure.Heading>
                        <Button slot="trigger" variant="secondary" size="sm">
                            {armoredDisclosure.triggerLabel ??
                                i18n.armoredSectionTitle}
                            <Disclosure.Indicator />
                        </Button>
                    </Disclosure.Heading>
                    <Disclosure.Content>
                        <Disclosure.Body className="mt-3 w-full">
                            {armoredPanel}
                        </Disclosure.Body>
                    </Disclosure.Content>
                </Disclosure>
            ) : (
                armoredPanel
            )}

            {previewBottom}
        </section>
    )
}

