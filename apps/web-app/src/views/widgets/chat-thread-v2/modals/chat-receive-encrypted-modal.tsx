import { useState } from "react"
import { Modal } from "@heroui/react"
import { useMutation } from "@tanstack/react-query"
import { useSnapshot } from "valtio/react"

import type { IChatThreadService } from "@/di/chat-thread/types"
import { useT } from "@/di/react/hooks/useT"

import { ChatImportQrBlockHeroUI } from "../components/chat-import-qr-block"
import { ChatImportQrPreviewHeroUI } from "../components/chat-import-qr-preview"

export function ChatReceiveEncryptedModalHeroUI({
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

    const [text, setText] = useState("")

    const onSend = useMutation({
        mutationFn: () => chat.importByRaw(text),
        onSuccess: () => {
            setText("")
        },
    })

    const importByQrClipboard = useMutation({
        mutationFn: () => chat.importByQrClipboard(),
    })

    const importByQrFile = useMutation({
        mutationFn: (file: File) => chat.importByQrFile(file),
    })

    const confirmSaveScannedInboundMutation = useMutation({
        mutationFn: () => chat.applyImport(),
        onSuccess: (ok) => {
            if (ok) {
                onSaved()
            }
        },
    })

    const isProcessing =
        onSend.isPending ||
        importByQrClipboard.isPending ||
        importByQrFile.isPending ||
        confirmSaveScannedInboundMutation.isPending

    if (!contact) {
        return null
    }

    return (
        <Modal
            isOpen={open}
            onOpenChange={(nextOpen: boolean) => {
                onOpenChange(nextOpen)

                if (!nextOpen) {
                    setText("")
                }
            }}
        >
            <Modal.Backdrop>
                <Modal.Container size="lg" scroll="inside">
                    <Modal.Dialog className="max-h-[min(92dvh,48rem)] overflow-hidden p-0">
                        <Modal.Header className="border-b border-divider px-4 py-3">
                            <div className="flex flex-col gap-1">
                                <span>{t("chat.receiveModalTitle")}</span>
                                <span className="text-sm font-normal text-default-500">
                                    {t("chat.receiveOnlyIncomingHint", {
                                        name: contact.displayName,
                                    })}
                                </span>
                            </div>
                        </Modal.Header>

                        <Modal.Body className="space-y-4 p-4">
                            <ChatImportQrBlockHeroUI
                                chat={chat}
                                pasteArmored={text}
                                onPasteArmoredChange={setText}
                                t={t}
                                isProcessing={isProcessing}
                                onSend={() => onSend.mutate()}
                                onPasteFromClipboard={() =>
                                    importByQrClipboard.mutate()
                                }
                                onPickFromFile={(file) => importByQrFile.mutate(file)}
                            >
                                {snap.import.data !== null && (
                                    <ChatImportQrPreviewHeroUI
                                        chat={chat}
                                        data={snap.import.data}
                                        t={t}
                                        onSave={() =>
                                            confirmSaveScannedInboundMutation.mutate()
                                        }
                                    />
                                )}
                            </ChatImportQrBlockHeroUI>
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}

