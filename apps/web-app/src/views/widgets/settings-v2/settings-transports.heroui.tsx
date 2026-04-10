import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button, Input, Surface, TextArea } from "@heroui/react"

import { qrTextBuiltinProfile } from "@/di/chat-transport/builtin-profiles"
import {
    BUILTIN_QR_TEXT_INSTANCE_ID,
    QR_TEXT_TRANSPORT_KIND,
} from "@/di/chat-transport/constants"
import {
    HttpRestInboundCoordinator,
    type IHttpRestInboundCoordinator,
} from "@/di/chat-transport/http-rest/v1/types"
import {
    ChatTransportRegistry,
    type IChatTransportRegistry,
    TransportPrefsService,
    type ITransportPrefsService,
    type TransportPrefsPayloadV1,
    type TransportProfilePlain,
} from "@/di/chat-transport/types"
import { useT } from "@/di/react/hooks/useT"
import { useDi } from "@/di/react/hooks/useDi"

export function SettingsTransportsHeroUI() {
    const t = useT()
    const prefsSvc = useDi<ITransportPrefsService>(TransportPrefsService)
    const registry = useDi<IChatTransportRegistry>(ChatTransportRegistry)
    const httpInbound = useDi<IHttpRestInboundCoordinator>(
        HttpRestInboundCoordinator,
    )

    const [payload, setPayload] = useState<TransportPrefsPayloadV1 | null>(null)
    const payloadRef = useRef<TransportPrefsPayloadV1 | null>(null)
    const [loading, setLoading] = useState(true)
    const [err, setErr] = useState<string | null>(null)
    const [saveOk, setSaveOk] = useState(false)

    const [newLabel, setNewLabel] = useState("Server profile")
    const [newKind, setNewKind] = useState("")
    const [newConfig, setNewConfig] = useState("{}")

    const [editingInstanceId, setEditingInstanceId] = useState<string | null>(
        null,
    )
    const [editLabel, setEditLabel] = useState("")
    const [editKind, setEditKind] = useState("")
    const [editConfig, setEditConfig] = useState("{}")

    const kinds = useMemo(() => registry.listKinds(), [registry])

    const editKindOptions = useMemo(() => {
        const k = editKind.trim()

        if (!k || kinds.includes(k)) {
            return kinds
        }

        return [k, ...kinds]
    }, [kinds, editKind])

    useEffect(() => {
        if (newKind || !kinds.length) {
            return
        }

        setNewKind(kinds[0] ?? QR_TEXT_TRANSPORT_KIND)
    }, [kinds, newKind])

    const reload = useCallback(async () => {
        setLoading(true)
        setErr(null)

        try {
            const p = await prefsSvc.load()

            payloadRef.current = p
            setPayload(p)
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e))
        } finally {
            setLoading(false)
        }
    }, [prefsSvc])

    useEffect(() => {
        void reload()
    }, [reload])

    const builtinDisplay: TransportProfilePlain = useMemo(
        () => ({
            instanceId: qrTextBuiltinProfile.instanceId,
            kind: qrTextBuiltinProfile.kind,
            label: t("transport.builtInQrLabel"),
            config: qrTextBuiltinProfile.config,
            enabled: true,
        }),
        [t],
    )

    const persistPrefs = useCallback(
        async (toSave: TransportPrefsPayloadV1) => {
            setErr(null)
            setSaveOk(false)

            try {
                await prefsSvc.save(toSave)
                void httpInbound.start()
                setSaveOk(true)
            } catch (e) {
                setErr(e instanceof Error ? e.message : String(e))
            }
        },
        [httpInbound, prefsSvc],
    )

    const onSave = async () => {
        const p = payloadRef.current

        if (!p) {
            return
        }

        await persistPrefs(p)
    }

    const onAddProfile = () => {
        if (!payload) {
            return
        }

        setErr(null)
        setSaveOk(false)

        let configObj: Record<string, unknown>

        try {
            const parsed = JSON.parse(newConfig) as unknown

            if (
                typeof parsed !== "object" ||
                parsed === null ||
                Array.isArray(parsed)
            ) {
                setErr(t("transport.invalidJson"))

                return
            }

            configObj = parsed as Record<string, unknown>
        } catch {
            setErr(t("transport.invalidJson"))

            return
        }

        const kind = newKind.trim() || QR_TEXT_TRANSPORT_KIND
        const next: TransportPrefsPayloadV1 = {
            ...payload,
            profiles: [
                ...payload.profiles,
                {
                    instanceId: crypto.randomUUID(),
                    kind,
                    label: newLabel.trim() || kind,
                    config: configObj,
                    enabled: true,
                },
            ],
        }

        payloadRef.current = next
        setPayload(next)
        void persistPrefs(next)
    }

    const onRemove = (instanceId: string) => {
        if (!payload || instanceId === BUILTIN_QR_TEXT_INSTANCE_ID) {
            return
        }

        setSaveOk(false)

        if (editingInstanceId === instanceId) {
            setEditingInstanceId(null)
        }

        const next: TransportPrefsPayloadV1 = {
            profiles: payload.profiles.filter(
                (p) => p.instanceId !== instanceId,
            ),
            defaultInstanceId:
                payload.defaultInstanceId === instanceId
                    ? null
                    : payload.defaultInstanceId,
        }

        payloadRef.current = next
        setPayload(next)
        void persistPrefs(next)
    }

    const startEdit = (p: TransportProfilePlain) => {
        setErr(null)
        setSaveOk(false)
        setEditingInstanceId(p.instanceId)
        setEditLabel(p.label)
        setEditKind(p.kind)
        setEditConfig(JSON.stringify(p.config, null, 2))
    }

    const cancelEdit = () => {
        setEditingInstanceId(null)
    }

    const onApplyEdit = () => {
        if (!payload || !editingInstanceId) {
            return
        }

        setErr(null)
        setSaveOk(false)

        let configObj: Record<string, unknown>

        try {
            const parsed = JSON.parse(editConfig) as unknown

            if (
                typeof parsed !== "object" ||
                parsed === null ||
                Array.isArray(parsed)
            ) {
                setErr(t("transport.invalidJson"))

                return
            }

            configObj = parsed as Record<string, unknown>
        } catch {
            setErr(t("transport.invalidJson"))

            return
        }

        const kind = editKind.trim() || QR_TEXT_TRANSPORT_KIND
        const nextProfiles = payload.profiles.map((p) => {
            if (p.instanceId !== editingInstanceId) {
                return p
            }

            return {
                ...p,
                kind,
                label: editLabel.trim() || kind,
                config: configObj,
            }
        })

        if (!nextProfiles.some((p) => p.instanceId === editingInstanceId)) {
            return
        }

        const next: TransportPrefsPayloadV1 = {
            ...payload,
            profiles: nextProfiles,
        }

        payloadRef.current = next
        setPayload(next)
        setEditingInstanceId(null)
        void persistPrefs(next)
    }

    const setDefault = (instanceId: string) => {
        if (!payload) {
            return
        }

        setSaveOk(false)

        const next: TransportPrefsPayloadV1 = {
            ...payload,
            defaultInstanceId: instanceId,
        }

        payloadRef.current = next
        setPayload(next)
        void persistPrefs(next)
    }

    if (loading || !payload) {
        return (
            <Surface
                className="flex items-center gap-3 rounded-3xl border border-divider p-6"
                variant="secondary"
            >
                <span className="text-sm text-default-500">
                    {t("common.loading")}
                </span>
            </Surface>
        )
    }

    const allIds: {
        id: string
        label: string
        kind: string
        builtIn: boolean
    }[] = [
        {
            id: builtinDisplay.instanceId,
            label: builtinDisplay.label,
            kind: builtinDisplay.kind,
            builtIn: true,
        },
        ...payload.profiles.map((p) => ({
            id: p.instanceId,
            label: p.label,
            kind: p.kind,
            builtIn: false,
        })),
    ]

    return (
        <Surface className="space-y-4 rounded-3xl p-5" variant="secondary">
            <div className="space-y-1">
                <h2 className="text-sm font-semibold">
                    {t("transport.settingsTitle")}
                </h2>
                <p className="text-xs text-default-500">
                    {t("transport.settingsHint")}
                </p>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-medium text-default-600">
                    {t("transport.defaultTransport")}
                </p>
                <div className="flex flex-wrap gap-2">
                    {allIds.map((row) => (
                        <Button
                            key={row.id}
                            size="sm"
                            variant={
                                payload.defaultInstanceId === row.id ||
                                (!payload.defaultInstanceId &&
                                    row.id === BUILTIN_QR_TEXT_INSTANCE_ID)
                                    ? "primary"
                                    : "outline"
                            }
                            onPress={() => setDefault(row.id)}
                        >
                            {row.label}
                        </Button>
                    ))}
                </div>
            </div>

            <ul className="space-y-2">
                <li className="flex items-center justify-between gap-2 rounded-xl border border-divider px-3 py-2 text-xs">
                    <span className="min-w-0 truncate font-medium">
                        {builtinDisplay.label}
                    </span>
                    <span className="shrink-0 text-default-500">
                        {t("transport.builtIn")} · {builtinDisplay.kind}
                    </span>
                </li>
                {payload.profiles.map((p) => (
                    <li
                        key={p.instanceId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-divider px-3 py-2 text-xs"
                    >
                        <div className="min-w-0">
                            <p className="truncate font-medium">{p.label}</p>
                            <p className="text-default-500">{p.kind}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1">
                            <Button
                                size="sm"
                                variant="outline"
                                onPress={() => startEdit(p)}
                            >
                                {t("transport.edit")}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onPress={() => onRemove(p.instanceId)}
                            >
                                {t("transport.remove")}
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>

            {editingInstanceId ? (
                <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs font-medium text-default-600">
                        {t("transport.editProfileHint")}
                    </p>
                    <Input
                        aria-label={t("transport.label")}
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        variant="secondary"
                        fullWidth
                    />
                    <label className="block text-xs text-default-600">
                        {t("transport.kind")}
                        <select
                            className="mt-1 w-full rounded-lg border border-divider bg-background px-3 py-2 text-sm"
                            value={editKind}
                            onChange={(e) => setEditKind(e.target.value)}
                        >
                            {editKindOptions.map((k) => (
                                <option key={k} value={k}>
                                    {k}
                                </option>
                            ))}
                        </select>
                    </label>
                    <TextArea
                        aria-label={t("transport.configJson")}
                        value={editConfig}
                        onChange={(e) => setEditConfig(e.target.value)}
                        variant="secondary"
                        fullWidth
                        className="min-h-[120px] font-mono text-xs"
                    />
                    {editKind.trim() === "http_rest_v1" ? (
                        <p className="text-xs text-default-500">
                            {t("transport.httpRestReceiveHint")}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="primary"
                            onPress={onApplyEdit}
                        >
                            {t("transport.applyChanges")}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onPress={cancelEdit}
                        >
                            {t("transport.cancelEdit")}
                        </Button>
                    </div>
                </div>
            ) : null}

            <div className="space-y-2 border-t border-divider pt-4">
                <p className="text-xs font-medium text-default-600">
                    {t("transport.addProfileFormHint")}
                </p>
                <Input
                    aria-label={t("transport.label")}
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    variant="secondary"
                    fullWidth
                />
                <label className="block text-xs text-default-600">
                    {t("transport.kind")}
                    <select
                        className="mt-1 w-full rounded-lg border border-divider bg-background px-3 py-2 text-sm"
                        value={newKind}
                        onChange={(e) => setNewKind(e.target.value)}
                    >
                        {kinds.map((k) => (
                            <option key={k} value={k}>
                                {k}
                            </option>
                        ))}
                    </select>
                </label>
                <TextArea
                    aria-label={t("transport.configJson")}
                    value={newConfig}
                    onChange={(e) => setNewConfig(e.target.value)}
                    variant="secondary"
                    fullWidth
                    className="min-h-[80px] font-mono text-xs"
                />
                {newKind.trim() === "http_rest_v1" ? (
                    <p className="text-xs text-default-500">
                        {t("transport.httpRestReceiveHint")}
                    </p>
                ) : null}
                <Button size="sm" variant="outline" onPress={onAddProfile}>
                    {t("transport.addToList")}
                </Button>
            </div>

            <Button
                type="button"
                variant="primary"
                onPress={() => void onSave()}
            >
                {t("transport.savePrefs")}
            </Button>

            {saveOk ? (
                <p className="text-xs font-medium text-primary">
                    {t("transport.prefsSaved")}
                </p>
            ) : null}
            {err ? <p className="text-sm text-danger">{err}</p> : null}
        </Surface>
    )
}
