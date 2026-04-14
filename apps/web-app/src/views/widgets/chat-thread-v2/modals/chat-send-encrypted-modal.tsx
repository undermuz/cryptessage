import { useCallback, useEffect, useMemo, useState } from "react"
import { Button, Modal, Tabs } from "@heroui/react"
import type { Key } from "@heroui/react"
import { useSnapshot } from "valtio/react"

import type { IChatThreadService } from "@/di/chat-thread/types"
import { HTTP_REST_V1_TRANSPORT_KIND } from "@/di/chat-transport/constants"
import {
    ChatTransportManager,
    ChatTransportOutgoingStore,
    type IChatTransportManager,
    type IChatTransportOutgoingStore,
    type ResolvedTransportProfile,
} from "@/di/chat-transport/types"
import {
    ConversationService,
    type IConversationService,
} from "@/di/conversation/types"
import type { ContactPlain } from "@/di/crypt-db/types-data"
import type { EncryptedOutgoingBundle } from "@/di/messaging-crypto/types"
import { useT } from "@/di/react/hooks/useT"
import { useDi } from "@/di/react/hooks/useDi"
import type { ExportQrLabels } from "@/views/widgets/qr-io-v2/export-qr-block"
import { TransportSendFallbackPanelHeroUI } from "@/views/widgets/chat-transport/panels/transport-send-fallback-panel"
import { transportSendPanelRegistry } from "@/views/widgets/chat-transport/transport-send-registry"

export function ChatSendEncryptedModalHeroUI(props: {
    open: boolean
    onOpenChange: (open: boolean) => void
    chat: IChatThreadService
    encryptedResult: EncryptedOutgoingBundle | null
    onNotify: (message: string | null) => void
    isPending: boolean
    initialTransportInstanceId?: string | null
}) {
    const {
        open,
        onOpenChange,
        chat,
        encryptedResult,
        onNotify,
        isPending,
        initialTransportInstanceId = null,
    } = props

    const t = useT()
    const snap = useSnapshot(chat.state)
    const contact = snap.contact

    const contactPlain: ContactPlain | null = useMemo(() => {
        if (!contact) {
            return null
        }

        return {
            ...contact,
            transport: {
                ...contact.transport,
                instanceOrder: contact.transport?.instanceOrder
                    ? [...contact.transport.instanceOrder]
                    : undefined,
            },
        }
    }, [contact])

    const transportMgr = useDi<IChatTransportManager>(ChatTransportManager)
    const conv = useDi<IConversationService>(ConversationService)
    const outgoing = useDi<IChatTransportOutgoingStore>(ChatTransportOutgoingStore)
    const outSnap = useSnapshot(outgoing.state)

    const [resolvedProfiles, setResolvedProfiles] = useState<
        ResolvedTransportProfile[]
    >([])
    const [profileLoading, setProfileLoading] = useState(false)
    const [selectedInstanceId, setSelectedInstanceId] = useState<string>("")
    const [localOrder, setLocalOrder] = useState<string[]>([])
    const [orderDirty, setOrderDirty] = useState(false)

    useEffect(() => {
        if (!open || !contactPlain) {
            return
        }

        setProfileLoading(true)

        void transportMgr
            .orderProfilesForContact(contactPlain)
            .then((list) => {
                setResolvedProfiles(list)
                setLocalOrder(list.map((p) => p.instanceId))
                setOrderDirty(false)
                setSelectedInstanceId((prev) => {
                    if (list.some((p) => p.instanceId === prev)) {
                        return prev
                    }

                    return list[0]?.instanceId ?? ""
                })
            })
            .finally(() => {
                setProfileLoading(false)
            })
    }, [open, contactPlain, transportMgr])

    useEffect(() => {
        if (!open || !initialTransportInstanceId || !resolvedProfiles.length) {
            return
        }

        if (
            resolvedProfiles.some(
                (p) => p.instanceId === initialTransportInstanceId,
            )
        ) {
            setSelectedInstanceId(initialTransportInstanceId)
        }
    }, [open, initialTransportInstanceId, resolvedProfiles])

    const orderedProfiles = useMemo(() => {
        if (!localOrder.length) {
            return resolvedProfiles
        }

        const byId = new Map(
            resolvedProfiles.map((p) => [p.instanceId, p] as const),
        )

        const out: ResolvedTransportProfile[] = []

        for (const id of localOrder) {
            const row = byId.get(id)

            if (row) {
                out.push(row)
            }
        }

        return out.length ? out : resolvedProfiles
    }, [resolvedProfiles, localOrder])

    const exportLabels: ExportQrLabels = useMemo(
        () => ({
            showQr: t("contacts.showQr"),
            hideQr: t("contacts.hideQr"),
            copyQrImage: t("contacts.copyQr"),
            shareQr: t("contacts.shareQr"),
            copyArmored: t("chat.copyArmored"),
            copyQrUnavailable: t("contacts.copyQrUnavailable"),
            copyQrFail: (reason) => t("contacts.copyQrFail", { reason }),
            copyQrOk: t("contacts.copyQrOk"),
            copyArmoredOk: t("chat.copyArmoredOk"),
            shareUnavailable: t("contacts.shareUnavailable"),
            shareFail: (reason) => t("contacts.shareFail", { reason }),
        }),
        [t],
    )

    const moveInstance = useCallback((instanceId: string, dir: -1 | 1) => {
        setLocalOrder((prev) => {
            const i = prev.indexOf(instanceId)

            if (i < 0) {
                return prev
            }

            const j = i + dir

            if (j < 0 || j >= prev.length) {
                return prev
            }

            const next = [...prev]

            ;[next[i], next[j]] = [next[j], next[i]]

            return next
        })

        setOrderDirty(true)
    }, [])

    const saveContactOrder = useCallback(async () => {
        if (!contactPlain || !localOrder.length) {
            return
        }

        try {
            await conv.saveContact({
                ...contactPlain,
                transport: {
                    ...contactPlain.transport,
                    instanceOrder: [...localOrder],
                },
            })

            onNotify(t("transport.orderSaved"))
            setOrderDirty(false)
            await chat.reload()
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)

            onNotify(reason)
        }
    }, [contactPlain, conv, localOrder, onNotify, t, chat])

    const activeProfile = orderedProfiles.find(
        (p) => p.instanceId === selectedInstanceId,
    )

    const ActivePanel =
        activeProfile &&
        (transportSendPanelRegistry[activeProfile.kind] ?? null)

    const retryNetworkSend = useCallback(async () => {
        if (!contactPlain || !activeProfile) {
            return
        }

        if (activeProfile.kind !== HTTP_REST_V1_TRANSPORT_KIND) {
            return
        }

        await transportMgr.retrySendByInstance(
            contactPlain,
            activeProfile.instanceId,
        )
    }, [activeProfile, contactPlain, transportMgr])

    return (
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="lg" scroll="inside">
                    <Modal.Dialog className="max-h-[min(90dvh,44rem)] overflow-hidden p-0">
                        <Modal.Header className="border-b border-divider px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                                <span>{t("chat.sendEncryptedTitle")}</span>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onPress={() => onOpenChange(false)}
                                >
                                    {t("common.close")}
                                </Button>
                            </div>
                        </Modal.Header>
                        <Modal.Body className="space-y-4 p-4">
                            {isPending && (
                                <p className="mb-3 text-sm text-default-500">
                                    {t("common.loading")}
                                </p>
                            )}

                            {profileLoading && (
                                <p className="text-sm text-default-500">
                                    {t("common.loading")}
                                </p>
                            )}

                            {contact &&
                                encryptedResult &&
                                orderedProfiles.length > 1 ? (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-default-600">
                                            {t("transport.channelTabs")}
                                        </p>
                                        <Tabs
                                            className="w-full"
                                            variant="secondary"
                                            selectedKey={selectedInstanceId}
                                            onSelectionChange={(key: Key) =>
                                                setSelectedInstanceId(String(key))
                                            }
                                        >
                                            <Tabs.ListContainer>
                                                <Tabs.List
                                                    aria-label={t(
                                                        "transport.channelTabs",
                                                    )}
                                                >
                                                    {orderedProfiles.map(
                                                        (p, idx) => (
                                                            <Tabs.Tab
                                                                key={p.instanceId}
                                                                id={p.instanceId}
                                                            >
                                                                {idx > 0 ? (
                                                                    <Tabs.Separator />
                                                                ) : null}
                                                                {p.label ||
                                                                p.kind}
                                                                <Tabs.Indicator />
                                                            </Tabs.Tab>
                                                        ),
                                                    )}
                                                </Tabs.List>
                                            </Tabs.ListContainer>
                                        </Tabs>
                                    </div>
                                ) : null}

                            {contact && encryptedResult && activeProfile ? (
                                ActivePanel ? (
                                    <ActivePanel
                                        bundle={encryptedResult}
                                        contactName={contact.displayName}
                                        labels={exportLabels}
                                        onNotify={onNotify}
                                        networkDelivery={
                                            outSnap.lastNetworkDelivery
                                        }
                                        onRetryNetworkSend={retryNetworkSend}
                                    />
                                ) : (
                                    <TransportSendFallbackPanelHeroUI
                                        transportKind={activeProfile.kind}
                                        bundle={encryptedResult}
                                        contactName={contact.displayName}
                                        labels={exportLabels}
                                        onNotify={onNotify}
                                        networkDelivery={
                                            outSnap.lastNetworkDelivery
                                        }
                                        onRetryNetworkSend={retryNetworkSend}
                                    />
                                )
                            ) : null}

                            {contact && orderedProfiles.length ? (
                                <div className="space-y-3 border-t border-divider pt-4">
                                    <div>
                                        <p className="text-xs font-medium text-default-600">
                                            {t("transport.priorityTitle")}
                                        </p>
                                        <p className="mt-1 text-xs text-default-500">
                                            {t("transport.priorityHint")}
                                        </p>
                                    </div>
                                    <ul className="space-y-2">
                                        {localOrder.map((id, idx) => {
                                            const p =
                                                resolvedProfiles.find(
                                                    (x) => x.instanceId === id,
                                                ) ?? null

                                            if (!p) {
                                                return null
                                            }

                                            return (
                                                <li
                                                    key={id}
                                                    className="flex items-center gap-2 rounded-xl border border-divider bg-default-50/50 px-3 py-2"
                                                >
                                                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                                                        {p.label || p.kind}
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        isDisabled={idx === 0}
                                                        onPress={() =>
                                                            moveInstance(
                                                                id,
                                                                -1,
                                                            )
                                                        }
                                                    >
                                                        {t("transport.moveUp")}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        isDisabled={
                                                            idx ===
                                                            localOrder.length -
                                                                1
                                                        }
                                                        onPress={() =>
                                                            moveInstance(id, 1)
                                                        }
                                                    >
                                                        {t(
                                                            "transport.moveDown",
                                                        )}
                                                    </Button>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        isDisabled={!orderDirty}
                                        onPress={() =>
                                            void saveContactOrder()
                                        }
                                    >
                                        {t("transport.saveOrder")}
                                    </Button>
                                </div>
                            ) : null}
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
