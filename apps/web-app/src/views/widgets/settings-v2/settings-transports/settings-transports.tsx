import { Button, Surface } from "@heroui/react"

import { useT } from "@/di/react/hooks/useT"

import { TransportAddModal } from "./transport-add-modal"
import { TransportDefaultPicker } from "./transport-default-picker"
import { TransportEditModal } from "./transport-edit-modal"
import { TransportProfileList } from "./transport-profile-list"
import { useSettingsTransports } from "./use-settings-transports"

export function SettingsTransports() {
    const t = useT()
    const s = useSettingsTransports()

    if (s.loading || !s.payload) {
        return (
            <Surface
                className="flex items-center gap-3 rounded-3xl border border-divider p-6"
                variant="default"
            >
                <span className="text-sm text-default-500">
                    {t("common.loading")}
                </span>
            </Surface>
        )
    }

    return (
        <Surface className="space-y-4 rounded-3xl p-5" variant="default">
            <div className="space-y-1">
                <h2 className="text-sm font-semibold">
                    {t("transport.settingsTitle")}
                </h2>
                <p className="text-xs text-default-500">
                    {t("transport.settingsHint")}
                </p>
            </div>

            <TransportDefaultPicker
                rows={s.defaultRows}
                defaultInstanceId={s.payload.defaultInstanceId}
                onSelect={s.setDefault}
            />

            <TransportProfileList
                builtinLabel={s.builtinDisplay.label}
                builtinKind={s.builtinDisplay.kind}
                profiles={s.payload.profiles}
                onEdit={s.startEdit}
                onRemove={s.onRemove}
            />

            <div className="border-t border-divider pt-4">
                <Button
                    size="sm"
                    variant="primary"
                    onPress={s.openAddModal}
                    isDisabled={s.creatableKinds.length === 0}
                >
                    {t("transport.addProfile")}
                </Button>
                {s.creatableKinds.length === 0 ? (
                    <p className="mt-2 text-xs text-default-500">
                        {t("transport.addProfileNoTypes")}
                    </p>
                ) : null}
            </div>

            {s.saveOk ? (
                <p className="text-xs font-medium text-primary">
                    {t("transport.prefsSaved")}
                </p>
            ) : null}
            {s.err && !s.editingInstanceId && !s.addModalOpen ? (
                <p className="text-sm text-danger">{s.err}</p>
            ) : null}

            <TransportEditModal
                open={s.editingInstanceId !== null}
                busy={s.transportFormBusy}
                error={s.err}
                label={s.editLabel}
                kind={s.editKind}
                configJson={s.editConfig}
                kindOptions={s.editKindOptions}
                onLabelChange={s.setEditLabel}
                onKindChange={s.setEditKind}
                onConfigChange={s.setEditConfig}
                onOpenChange={(open) => {
                    if (!open) {
                        s.cancelEdit()
                    }
                }}
                onCancel={s.cancelEdit}
                onSubmit={s.onApplyEdit}
            />

            <TransportAddModal
                open={s.addModalOpen}
                busy={s.transportFormBusy}
                error={s.err}
                label={s.newLabel}
                kind={s.newKind}
                configJson={s.newConfig}
                creatableKinds={s.creatableKinds}
                onLabelChange={s.setNewLabel}
                onKindChange={s.setNewKind}
                onConfigChange={s.setNewConfig}
                onOpenChange={s.setAddModalOpen}
                onDismiss={() => s.setAddModalOpen(false)}
                onSubmit={s.onAddProfile}
            />
        </Surface>
    )
}
