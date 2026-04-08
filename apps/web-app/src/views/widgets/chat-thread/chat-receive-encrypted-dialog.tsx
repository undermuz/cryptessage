import { QR_MESSAGE_MAX_BYTES } from "@/di/secure/constants"
import { useT } from "@/di/react/hooks/useT"
import { Button } from "@/views/ui/button"
import { useSnapshot } from "valtio/react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/views/ui/dialog"
import { ImportQrBlock } from "@/views/widgets/qr-io/import-qr-block"
import { ImportQrPreviewShell } from "@/views/widgets/qr-io/import-qr-preview-shell"

import type { IChatThreadService } from "@/di/chat-thread/types"

import { payloadByteLength } from "./utils"

export function ChatReceiveEncryptedDialog({
    open,
    onOpenChange,
    chat,
    onSaved,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    chat: IChatThreadService
    onSaved: () => void
}) {
    const t = useT()
    const snap = useSnapshot(chat.state)
    const contact = snap.contact

    if (!contact) {
        return null
    }

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
                        armoredValue={snap.pasteIn}
                        onArmoredChange={(v) => chat.setPasteIn(v)}
                        onArmoredSubmit={() => void chat.decryptArmoredPaste()}
                        armoredSubmitDisabled={!snap.pasteIn.trim()}
                        pasteBusy={snap.pasteQrBusy}
                        scanOpen={snap.importScan}
                        onOpenScan={() => chat.setImportScan(true)}
                        onCloseScan={() => chat.setImportScan(false)}
                        onPasteQrFromImage={() =>
                            void chat.pasteMessageQrFromClipboard()
                        }
                        onPickQrImageFile={(file) =>
                            void chat.pickMessageQrFromFile(file)
                        }
                        onScannedPayload={(payload) =>
                            chat.setImportPending({
                                raw: payload,
                                source: "camera",
                            })
                        }
                        preview={
                            snap.importPending ? (
                                <ImportQrPreviewShell
                                    title={t("chat.reviewScannedCiphertext")}
                                    metaLine={`${
                                        snap.importPending.source === "camera"
                                            ? t("contacts.reviewSourceCamera")
                                            : snap.importPending.source === "file"
                                                ? t("contacts.reviewSourceFile")
                                                : t("contacts.reviewSourceClipboard")
                                    } · ${t("contacts.reviewPayloadSize", {
                                        n: payloadByteLength(snap.importPending.raw),
                                    })}`}
                                    qrPayload={snap.importPending.raw}
                                    maxQrBytes={QR_MESSAGE_MAX_BYTES}
                                    tooLongHint={t("contacts.reviewQrTooLong")}
                                >
                                    {snap.importDecryptLoading && (
                                        <p className="text-muted-foreground">
                                            {t("common.loading")}
                                        </p>
                                    )}
                                    {snap.importDecryptErr && (
                                        <p className="text-sm text-destructive">
                                            {snap.importDecryptErr}
                                        </p>
                                    )}
                                    {snap.importDecryptPreview && (
                                        <>
                                            <p className="text-sm font-medium">
                                                {t("chat.decrypted")}
                                            </p>
                                            <p className="rounded-md bg-muted p-2 text-sm">
                                                {snap.importDecryptPreview.text}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {snap.importDecryptPreview.signaturesValid
                                                    ? t("chat.signatureOk")
                                                    : t("chat.signatureBad")}
                                            </p>
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                <Button
                                                    type="button"
                                                    onClick={() =>
                                                        void chat
                                                            .confirmSaveScannedInbound()
                                                            .then((ok) => {
                                                                if (ok) {
                                                                    onSaved()
                                                                }
                                                            })
                                                    }
                                                >
                                                    {t("chat.saveInbound")}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        chat.setImportPending(null)
                                                    }
                                                >
                                                    {t("contacts.discardReview")}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                    {!snap.importDecryptLoading &&
                                        snap.importDecryptErr &&
                                        !snap.importDecryptPreview && (
                                        <div className="pt-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    chat.setImportPending(null)
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
