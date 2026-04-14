import { Button, Input, Modal, Surface } from "@heroui/react"

import { HTTP_REST_V1_TRANSPORT_KIND } from "@/di/chat-transport/constants"
import { useT } from "@/di/react/hooks/useT"

export function ChatThreadTransportModal(props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    httpInboxId: string
    onHttpInboxIdChange: (value: string) => void
    onSave: () => void
    saveBusy: boolean
}) {
    const {
        open,
        onOpenChange,
        httpInboxId,
        onHttpInboxIdChange,
        onSave,
        saveBusy,
    } = props
    const t = useT()

    return (
        <Modal
            isOpen={open}
            onOpenChange={(next) => {
                if (!next && saveBusy) {
                    return
                }

                onOpenChange(next)
            }}
        >
            <Modal.Backdrop>
                <Modal.Container size="md" scroll="inside">
                    <Modal.Dialog className="max-h-[min(92dvh,36rem)] overflow-hidden p-0">
                        <Modal.Header className="border-b border-divider px-4 py-3">
                            <span className="text-sm font-semibold">
                                {t("chat.transportSettingsTitle")}
                            </span>
                        </Modal.Header>
                        <Modal.Body className="space-y-4 p-4">
                            <Surface
                                variant="default"
                                className="space-y-3 rounded-2xl border border-divider p-4"
                            >
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-default-600">
                                        {HTTP_REST_V1_TRANSPORT_KIND}
                                    </p>
                                    <p className="text-xs text-default-500">
                                        {t(
                                            "chat.transportHttpRestInboxBlockHint",
                                        )}
                                    </p>
                                </div>
                                <Input
                                    aria-label={t("transport.httpInboxIdLabel")}
                                    placeholder={t(
                                        "transport.httpInboxIdPlaceholder",
                                    )}
                                    value={httpInboxId}
                                    onChange={(e) =>
                                        onHttpInboxIdChange(e.target.value)
                                    }
                                    variant="secondary"
                                    fullWidth
                                />
                            </Surface>

                            <Button
                                size="sm"
                                variant="primary"
                                isDisabled={saveBusy}
                                isPending={saveBusy}
                                onPress={() => onSave()}
                            >
                                {t("transport.httpInboxIdSave")}
                            </Button>
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
