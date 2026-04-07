import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"
import type { ContactPlain } from "@/di/crypt-db/types-data"
import { QR_MESSAGE_MAX_BYTES } from "@/di/secure/constants"
import { useT } from "@/di/react/hooks/useT"
import { Button } from "@/views/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/views/ui/dialog"
import { ImportQrBlock } from "@/views/widgets/qr-io/import-qr-block"
import { ImportQrPreviewShell } from "@/views/widgets/qr-io/import-qr-preview-shell"

import { payloadByteLength } from "./utils"
import type { ImportSource } from "./types"

export function ChatReceiveEncryptedDialog({
    open,
    onOpenChange,
    contact,
    pasteIn,
    onPasteInChange,
    onDecryptArmoredPaste,
    pasteQrBusy,
    importScan,
    onImportScanOpen,
    onImportScanClose,
    onPasteMessageQrFromClipboard,
    onPickMessageQrFromFile,
    importPending,
    onImportPending,
    importDecryptLoading,
    importDecryptPreview,
    importDecryptErr,
    onConfirmSaveScannedInbound,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact: ContactPlain
    pasteIn: string
    onPasteInChange: (v: string) => void
    onDecryptArmoredPaste: () => void
    pasteQrBusy: boolean
    importScan: boolean
    onImportScanOpen: () => void
    onImportScanClose: () => void
    onPasteMessageQrFromClipboard: () => void
    onPickMessageQrFromFile: (file: File) => void
    importPending: {
        raw: VisitCardRawPayload
        source: ImportSource
    } | null
    onImportPending: (
        v: { raw: VisitCardRawPayload; source: ImportSource } | null,
    ) => void
    importDecryptLoading: boolean
    importDecryptPreview: {
        text: string
        signaturesValid: boolean
    } | null
    importDecryptErr: string | null
    onConfirmSaveScannedInbound: () => void
}) {
    const t = useT()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton
                className="flex max-h-[min(92dvh,48rem)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
            >
                <DialogHeader className="border-b border-border px-4 py-3 pr-10">
                    <DialogTitle className="text-left">
                        {t("chat.receiveModalTitle")}
                    </DialogTitle>
                    <DialogDescription className="text-left">
                        {t("chat.receiveOnlyIncomingHint", {
                            name: contact.displayName,
                        })}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[min(75dvh,40rem)] min-h-0 overflow-y-auto p-4">
                    <ImportQrBlock
                        heading={t("chat.receiveEncrypted")}
                        labels={{
                            scan: t("chat.scanMessageQr"),
                            pasteFromImage: t("contacts.pasteQr"),
                            pasteFromImagePending: t("contacts.pasteQrBusy"),
                            pickQrImage: t("contacts.pickQrImage"),
                            armoredSectionTitle: t("chat.pasteIn"),
                            armoredSubmit: t("chat.decryptBtn"),
                        }}
                        armoredPlaceholder={t("chat.pasteArmoredPlaceholder")}
                        armoredValue={pasteIn}
                        onArmoredChange={onPasteInChange}
                        onArmoredSubmit={onDecryptArmoredPaste}
                        armoredSubmitDisabled={!pasteIn.trim()}
                        pasteBusy={pasteQrBusy}
                        scanOpen={importScan}
                        onOpenScan={onImportScanOpen}
                        onCloseScan={onImportScanClose}
                        onPasteQrFromImage={onPasteMessageQrFromClipboard}
                        onPickQrImageFile={onPickMessageQrFromFile}
                        onScannedPayload={(payload) =>
                            onImportPending({
                                raw: payload,
                                source: "camera",
                            })
                        }
                        preview={
                            importPending ? (
                                <ImportQrPreviewShell
                                    title={t("chat.reviewScannedCiphertext")}
                                    metaLine={`${
                                        importPending.source === "camera"
                                            ? t("contacts.reviewSourceCamera")
                                            : importPending.source === "file"
                                                ? t("contacts.reviewSourceFile")
                                                : t("contacts.reviewSourceClipboard")
                                    } · ${t("contacts.reviewPayloadSize", {
                                        n: payloadByteLength(importPending.raw),
                                    })}`}
                                    qrPayload={importPending.raw}
                                    maxQrBytes={QR_MESSAGE_MAX_BYTES}
                                    tooLongHint={t("contacts.reviewQrTooLong")}
                                >
                                    {importDecryptLoading && (
                                        <p className="text-muted-foreground">
                                            {t("common.loading")}
                                        </p>
                                    )}
                                    {importDecryptErr && (
                                        <p className="text-sm text-destructive">
                                            {importDecryptErr}
                                        </p>
                                    )}
                                    {importDecryptPreview && (
                                        <>
                                            <p className="text-sm font-medium">
                                                {t("chat.decrypted")}
                                            </p>
                                            <p className="rounded-md bg-muted p-2 text-sm">
                                                {importDecryptPreview.text}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {importDecryptPreview.signaturesValid
                                                    ? t("chat.signatureOk")
                                                    : t("chat.signatureBad")}
                                            </p>
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                <Button
                                                    type="button"
                                                    onClick={
                                                        onConfirmSaveScannedInbound
                                                    }
                                                >
                                                    {t("chat.saveInbound")}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        onImportPending(null)
                                                    }
                                                >
                                                    {t("contacts.discardReview")}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                    {!importDecryptLoading &&
                                        importDecryptErr &&
                                        !importDecryptPreview && (
                                        <div className="pt-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    onImportPending(null)
                                                }
                                            >
                                                {t("contacts.discardReview")}
                                            </Button>
                                        </div>
                                    )}
                                </ImportQrPreviewShell>
                            ) : undefined
                        }
                    />
                </div>
            </DialogContent>
        </Dialog>
    )
}
