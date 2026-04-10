import { Button, Modal } from "@heroui/react"

import { useT } from "@/di/react/hooks/useT"

export function DeleteChatConfirmModalHeroUI(props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    displayName: string
    busy: boolean
    error: string | null
    onConfirm: () => void
}) {
    const { open, onOpenChange, displayName, busy, error, onConfirm } = props
    const t = useT()

    return (
        <Modal
            isOpen={open}
            onOpenChange={(next) => {
                if (!next && busy) {
                    return
                }

                onOpenChange(next)
            }}
        >
            <Modal.Backdrop>
                <Modal.Container size="md">
                    <Modal.Dialog className="p-0">
                        <Modal.Header className="border-b border-divider px-4 py-3">
                            <span className="text-sm font-semibold">
                                {t("chat.deleteChatTitle")}
                            </span>
                        </Modal.Header>
                        <Modal.Body className="space-y-3 p-4">
                            <p className="text-sm leading-relaxed text-default-600">
                                {t("chat.deleteChatBody", { name: displayName })}
                            </p>
                            {error ? (
                                <p className="text-sm text-danger">{error}</p>
                            ) : null}
                        </Modal.Body>
                        <Modal.Footer className="flex justify-end gap-2 border-t border-divider px-4 py-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                isDisabled={busy}
                                onPress={() => onOpenChange(false)}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                isDisabled={busy}
                                onPress={() => onConfirm()}
                            >
                                {t("chat.deleteChatConfirm")}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
