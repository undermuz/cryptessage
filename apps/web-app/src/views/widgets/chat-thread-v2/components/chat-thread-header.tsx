import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
    ArrowLeft,
    Inbox,
    MoreVertical,
    RefreshCw,
    Trash2,
} from "lucide-react"
import {
    Button,
    Dropdown,
    Header,
    Label,
    Separator,
    Spinner,
} from "@heroui/react"
import { useSnapshot } from "valtio/react"

import {
    HttpRestInboundCoordinator,
    type IHttpRestInboundCoordinator,
} from "@/di/chat-transport/http-rest/v1/types"
import type { IChatThreadService } from "@/di/chat-thread/types"
import {
    ConversationService,
    type IConversationService,
} from "@/di/conversation/types"
import type { ContactPlain } from "@/di/crypt-db/types-data"
import { useDi } from "@/di/react/hooks/useDi"
import { useT } from "@/di/react/hooks/useT"

import { DeleteChatConfirmModal } from "@/views/widgets/delete-chat-confirm-modal"

import { ChatThreadTransportModal } from "./chat-thread-transport-modal"
import { initialsFromName } from "../utils"

export function ChatThreadHeader({
    chat,
    onReceiveClick,
}: {
    chat: IChatThreadService
    onReceiveClick: () => void
}) {
    const t = useT()
    const navigate = useNavigate()
    const snap = useSnapshot(chat.state)
    const contact = snap.contact
    const conv = useDi<IConversationService>(ConversationService)
    const httpInbound = useDi<IHttpRestInboundCoordinator>(
        HttpRestInboundCoordinator,
    )
    const inboundSnap = useSnapshot(httpInbound.manualInboundUi)

    const [httpInboxId, setHttpInboxId] = useState("")
    const [transportModalOpen, setTransportModalOpen] = useState(false)
    const [transportSaveBusy, setTransportSaveBusy] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteBusy, setDeleteBusy] = useState(false)
    const [deleteErr, setDeleteErr] = useState<string | null>(null)
    const [manualInboxBusy, setManualInboxBusy] = useState(false)

    useEffect(() => {
        if (!contact) {
            return
        }

        setHttpInboxId(contact.transport?.httpRestInboxRecipientKeyId ?? "")
    }, [contact])

    if (!contact) {
        return null
    }

    const saveHttpInboxId = async () => {
        const v = httpInboxId.trim()
        const next: ContactPlain = {
            id: contact.id,
            displayName: contact.displayName,
            createdAt: contact.createdAt,
            crypto: contact.crypto,
            transport: {
                instanceOrder: contact.transport?.instanceOrder
                    ? [...contact.transport.instanceOrder]
                    : undefined,
                preferredInstanceId: contact.transport?.preferredInstanceId,
                httpRestInboxRecipientKeyId: v.length > 0 ? v : undefined,
            },
        }

        setTransportSaveBusy(true)

        try {
            await conv.saveContact(next)
            await chat.reload()
            setTransportModalOpen(false)
        } finally {
            setTransportSaveBusy(false)
        }
    }

    return (
        <div className="w-full rounded-2xl border border-divider bg-content1/95 shadow-xl shadow-black/10 ring-1 ring-black/5 backdrop-blur-xl dark:bg-default-100/90 dark:ring-white/10 sm:rounded-3xl">
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                    <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        aria-label={t("chat.back")}
                        onPress={() => void navigate({ to: "/" })}
                    >
                        <ArrowLeft className="size-5" />
                    </Button>
                    <div
                        className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-xs font-bold text-primary-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                        aria-hidden
                    >
                        {initialsFromName(contact.displayName)}
                    </div>
                    <div className="min-w-0">
                        <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight">
                            {contact.displayName}
                        </h1>
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-default-500">
                            {contact.crypto.protocol}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                    {inboundSnap.canManualRefresh ? (
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            isDisabled={manualInboxBusy}
                            aria-label={t("chat.httpInboxManualRefresh")}
                            onPress={() => {
                                void (async () => {
                                    setManualInboxBusy(true)

                                    try {
                                        await httpInbound.refreshManualHttpInboxes()
                                    } finally {
                                        setManualInboxBusy(false)
                                    }
                                })()
                            }}
                        >
                            {manualInboxBusy ? (
                                <Spinner size="sm" />
                            ) : (
                                <RefreshCw className="size-5" />
                            )}
                        </Button>
                    ) : null}
                    <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        aria-label={t("chat.receiveMessages")}
                        onPress={onReceiveClick}
                    >
                        <Inbox className="size-5" />
                    </Button>
                    <Dropdown>
                        <Dropdown.Trigger>
                            <Button
                                isIconOnly
                                variant="ghost"
                                size="sm"
                                aria-label={t("chat.chatMenu")}
                            >
                                <MoreVertical className="size-5" />
                            </Button>
                        </Dropdown.Trigger>
                        <Dropdown.Popover
                            placement="bottom end"
                            className="min-w-[14rem]"
                        >
                            <Dropdown.Menu
                                onAction={(key) => {
                                    const id = String(key)

                                    if (id === "transport-settings") {
                                        setTransportModalOpen(true)
                                    }

                                    if (id === "delete-chat") {
                                        setDeleteErr(null)
                                        setDeleteOpen(true)
                                    }
                                }}
                            >
                                <Dropdown.Section>
                                    <Header>{t("chat.chatMenuSection")}</Header>
                                    <Dropdown.Item
                                        id="transport-settings"
                                        textValue={t(
                                            "chat.transportSettingsMenu",
                                        )}
                                    >
                                        <Label>
                                            {t("chat.transportSettingsMenu")}
                                        </Label>
                                    </Dropdown.Item>
                                </Dropdown.Section>
                                <Separator />
                                <Dropdown.Section>
                                    <Dropdown.Item
                                        id="delete-chat"
                                        textValue={t("chat.deleteChatMenu")}
                                    >
                                        <Label className="flex items-center gap-2 text-danger">
                                            <Trash2
                                                className="size-4 shrink-0"
                                                aria-hidden
                                            />
                                            {t("chat.deleteChatMenu")}
                                        </Label>
                                    </Dropdown.Item>
                                </Dropdown.Section>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
            </div>

            <ChatThreadTransportModal
                open={transportModalOpen}
                onOpenChange={setTransportModalOpen}
                httpInboxId={httpInboxId}
                onHttpInboxIdChange={setHttpInboxId}
                onSave={() => void saveHttpInboxId()}
                saveBusy={transportSaveBusy}
            />

            <DeleteChatConfirmModal
                open={deleteOpen}
                displayName={contact.displayName}
                busy={deleteBusy}
                error={deleteErr}
                onOpenChange={(next) => {
                    setDeleteOpen(next)

                    if (!next) {
                        setDeleteErr(null)
                    }
                }}
                onConfirm={async () => {
                    setDeleteBusy(true)
                    setDeleteErr(null)

                    try {
                        await conv.deleteContact(contact.id)
                        setDeleteOpen(false)
                        await navigate({ to: "/" })
                    } catch (e) {
                        const reason =
                            e instanceof Error ? e.message : String(e)

                        setDeleteErr(t("chat.deleteChatFailed", { reason }))
                    } finally {
                        setDeleteBusy(false)
                    }
                }}
            />
        </div>
    )
}
