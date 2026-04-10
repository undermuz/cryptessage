import { useEffect, useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { Inbox, Trash2 } from "lucide-react"
import { Button, Input } from "@heroui/react"
import { useSnapshot } from "valtio/react"

import type { IChatThreadService } from "@/di/chat-thread/types"
import {
    ConversationService,
    type IConversationService,
} from "@/di/conversation/types"
import type { ContactPlain } from "@/di/crypt-db/types-data"
import { useDi } from "@/di/react/hooks/useDi"
import { useT } from "@/di/react/hooks/useT"

import { DeleteChatConfirmModalHeroUI } from "@/views/widgets/delete-chat-confirm-modal.heroui"

import { initialsFromName } from "../utils"

export function ChatThreadHeaderHeroUI({
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

    const [httpInboxId, setHttpInboxId] = useState("")
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteBusy, setDeleteBusy] = useState(false)
    const [deleteErr, setDeleteErr] = useState<string | null>(null)

    useEffect(() => {
        if (!contact) {
            return
        }

        setHttpInboxId(contact.httpRestInboxRecipientKeyId ?? "")
    }, [contact?.id, contact?.httpRestInboxRecipientKeyId])

    if (!contact) {
        return null
    }

    const saveHttpInboxId = async () => {
        const v = httpInboxId.trim()
        const next: ContactPlain = {
            id: contact.id,
            displayName: contact.displayName,
            createdAt: contact.createdAt,
            cryptoProtocol: contact.cryptoProtocol,
            publicKeyArmored: contact.publicKeyArmored,
            compactX25519PublicKeyB64: contact.compactX25519PublicKeyB64,
            compactEd25519PublicKeyB64: contact.compactEd25519PublicKeyB64,
            transportInstanceOrder: contact.transportInstanceOrder
                ? [...contact.transportInstanceOrder]
                : undefined,
            preferredTransportInstanceId: contact.preferredTransportInstanceId,
            httpRestInboxRecipientKeyId: v.length > 0 ? v : undefined,
        }

        await conv.saveContact(next)
        await chat.reload()
    }

    return (
        <div className="shrink-0 border-b border-divider bg-default-50/95 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
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
                            {contact.cryptoProtocol}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        aria-label={t("chat.receiveMessages")}
                        onPress={onReceiveClick}
                    >
                        <Inbox className="size-5" />
                    </Button>
                    <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        aria-label={t("chat.deleteChat")}
                        onPress={() => {
                            setDeleteErr(null)
                            setDeleteOpen(true)
                        }}
                    >
                        <Trash2 className="size-5 text-danger" />
                    </Button>
                    <Link
                        to="/"
                        className="rounded-lg px-2.5 py-2 text-sm font-medium text-default-600 transition-colors hover:bg-default-100 hover:text-foreground"
                    >
                        {t("chat.back")}
                    </Link>
                </div>
            </div>
            <div className="flex flex-wrap items-end gap-2 border-t border-divider/60 px-4 py-2">
                <Input
                    aria-label={t("transport.httpInboxIdLabel")}
                    placeholder={t("transport.httpInboxIdPlaceholder")}
                    value={httpInboxId}
                    onChange={(e) => setHttpInboxId(e.target.value)}
                    variant="secondary"
                    className="min-w-[12rem] max-w-md flex-1"
                />
                <Button
                    size="sm"
                    variant="outline"
                    onPress={() => void saveHttpInboxId()}
                >
                    {t("transport.httpInboxIdSave")}
                </Button>
            </div>

            <DeleteChatConfirmModalHeroUI
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
