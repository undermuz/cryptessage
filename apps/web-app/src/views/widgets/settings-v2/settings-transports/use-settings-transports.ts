import { useCallback, useEffect, useMemo, useRef, useState } from "react"

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

export type TransportDefaultRow = {
    id: string
    label: string
    kind: string
    builtIn: boolean
}

export function useSettingsTransports() {
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

    const [addModalOpen, setAddModalOpen] = useState(false)
    const [transportFormBusy, setTransportFormBusy] = useState(false)

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

    const creatableKinds = useMemo(
        () => kinds.filter((k) => k !== QR_TEXT_TRANSPORT_KIND),
        [kinds],
    )

    const editKindOptions = useMemo(() => {
        const k = editKind.trim()

        if (!k || kinds.includes(k)) {
            return kinds
        }

        return [k, ...kinds]
    }, [kinds, editKind])

    useEffect(() => {
        if (newKind || !creatableKinds.length) {
            return
        }

        setNewKind(creatableKinds[0] ?? "")
    }, [creatableKinds, newKind])

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
        async (toSave: TransportPrefsPayloadV1): Promise<boolean> => {
            setErr(null)
            setSaveOk(false)

            try {
                await prefsSvc.save(toSave)
                void httpInbound.start()
                setSaveOk(true)

                return true
            } catch (e) {
                setErr(e instanceof Error ? e.message : String(e))

                return false
            }
        },
        [httpInbound, prefsSvc],
    )

    const openAddModal = useCallback(() => {
        if (!creatableKinds.length) {
            return
        }

        setErr(null)
        setSaveOk(false)
        setNewLabel("Server profile")
        setNewConfig("{}")
        setNewKind(creatableKinds[0] ?? "")
        setAddModalOpen(true)
    }, [creatableKinds])

    const onAddProfile = useCallback(async () => {
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

        const kind = newKind.trim()

        if (!kind) {
            setErr(t("transport.kindRequired"))

            return
        }

        if (kind === QR_TEXT_TRANSPORT_KIND) {
            setErr(t("transport.qrTextNotCreatable"))

            return
        }

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
        setTransportFormBusy(true)

        try {
            const ok = await persistPrefs(next)

            if (ok) {
                setAddModalOpen(false)
            }
        } finally {
            setTransportFormBusy(false)
        }
    }, [newConfig, newKind, newLabel, payload, persistPrefs, t])

    const onRemove = useCallback(
        (instanceId: string) => {
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
        },
        [editingInstanceId, payload, persistPrefs],
    )

    const startEdit = useCallback((p: TransportProfilePlain) => {
        setErr(null)
        setSaveOk(false)
        setEditingInstanceId(p.instanceId)
        setEditLabel(p.label)
        setEditKind(p.kind)
        setEditConfig(JSON.stringify(p.config, null, 2))
    }, [])

    const cancelEdit = useCallback(() => {
        setEditingInstanceId(null)
    }, [])

    const onApplyEdit = useCallback(async () => {
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
        setTransportFormBusy(true)

        try {
            const ok = await persistPrefs(next)

            if (ok) {
                setEditingInstanceId(null)
            }
        } finally {
            setTransportFormBusy(false)
        }
    }, [editConfig, editKind, editLabel, editingInstanceId, payload, persistPrefs, t])

    const setDefault = useCallback(
        (instanceId: string) => {
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
        },
        [payload, persistPrefs],
    )

    const defaultRows: TransportDefaultRow[] = useMemo(() => {
        if (!payload) {
            return []
        }

        return [
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
    }, [builtinDisplay, payload])

    return {
        t,
        loading,
        payload,
        err,
        saveOk,
        builtinDisplay,
        defaultRows,
        creatableKinds,
        addModalOpen,
        setAddModalOpen,
        transportFormBusy,
        editingInstanceId,
        editLabel,
        setEditLabel,
        editKind,
        setEditKind,
        editConfig,
        setEditConfig,
        editKindOptions,
        newLabel,
        setNewLabel,
        newKind,
        setNewKind,
        newConfig,
        setNewConfig,
        openAddModal,
        onAddProfile,
        onRemove,
        startEdit,
        cancelEdit,
        onApplyEdit,
        setDefault,
    }
}
