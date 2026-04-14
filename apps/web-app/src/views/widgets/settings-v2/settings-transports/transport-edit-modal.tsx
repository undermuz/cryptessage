import { Button, Input, Modal, TextArea } from "@heroui/react"

import { HTTP_REST_V1_TRANSPORT_KIND } from "@/di/chat-transport/constants"
import { useT } from "@/di/react/hooks/useT"

export function TransportEditModal(props: {
    open: boolean
    busy: boolean
    error: string | null
    label: string
    kind: string
    configJson: string
    kindOptions: string[]
    onLabelChange: (value: string) => void
    onKindChange: (value: string) => void
    onConfigChange: (value: string) => void
    onOpenChange: (open: boolean) => void
    onCancel: () => void
    onSubmit: () => void
}) {
    const {
        open,
        busy,
        error,
        label,
        kind,
        configJson,
        kindOptions,
        onLabelChange,
        onKindChange,
        onConfigChange,
        onOpenChange,
        onCancel,
        onSubmit,
    } = props
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
                <Modal.Container size="md" scroll="inside">
                    <Modal.Dialog className="max-h-[min(92dvh,40rem)] overflow-hidden p-0">
                        <Modal.Header className="border-b border-divider px-4 py-3">
                            <span className="text-sm font-semibold">
                                {t("transport.editProfileHint")}
                            </span>
                        </Modal.Header>
                        <Modal.Body className="space-y-3 p-4">
                            <Input
                                aria-label={t("transport.label")}
                                value={label}
                                onChange={(e) => onLabelChange(e.target.value)}
                                variant="secondary"
                                fullWidth
                                disabled={busy}
                            />
                            <label className="block text-xs text-default-600">
                                {t("transport.kind")}
                                <select
                                    className="mt-1 w-full rounded-lg border border-divider bg-background px-3 py-2 text-sm disabled:opacity-60"
                                    value={kind}
                                    onChange={(e) => onKindChange(e.target.value)}
                                    disabled={busy}
                                >
                                    {kindOptions.map((k) => (
                                        <option key={k} value={k}>
                                            {k}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <TextArea
                                aria-label={t("transport.configJson")}
                                value={configJson}
                                onChange={(e) =>
                                    onConfigChange(e.target.value)
                                }
                                variant="secondary"
                                fullWidth
                                className="min-h-[120px] font-mono text-xs"
                                disabled={busy}
                            />
                            {kind.trim() === HTTP_REST_V1_TRANSPORT_KIND ? (
                                <p className="text-xs text-default-500">
                                    {t("transport.httpRestReceiveHint")}
                                </p>
                            ) : null}
                            {error ? (
                                <p className="text-sm text-danger">{error}</p>
                            ) : null}
                        </Modal.Body>
                        <Modal.Footer className="flex flex-wrap justify-end gap-2 border-t border-divider px-4 py-3">
                            <Button
                                size="sm"
                                variant="tertiary"
                                onPress={onCancel}
                                isDisabled={busy}
                            >
                                {t("transport.cancelEdit")}
                            </Button>
                            <Button
                                size="sm"
                                variant="primary"
                                onPress={() => void onSubmit()}
                                isDisabled={busy}
                                isPending={busy}
                            >
                                {t("transport.applyChanges")}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
