import { useCallback, useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { MessageCircle, Trash2 } from "lucide-react"

import { Button, Spinner, Surface } from "@heroui/react"

import { useT } from "@/di/react/hooks/useT"
import { useDi } from "@/di/react/hooks/useDi"
import {
    ConversationService,
    type IConversationService,
} from "@/di/conversation/types"
import {
    IdentityService,
    type IIdentityService,
} from "@/di/identity/types"
import type { ContactPlain } from "@/di/crypt-db/types-data"

import { DeleteChatConfirmModalHeroUI } from "@/views/widgets/delete-chat-confirm-modal.heroui"

export function ChatListWidgetHeroUI() {
    const t = useT()
    const conv = useDi<IConversationService>(ConversationService)
    const identity = useDi<IIdentityService>(IdentityService)

    const [contacts, setContacts] = useState<ContactPlain[]>([])
    const [loading, setLoading] = useState(true)
    const [pendingDelete, setPendingDelete] = useState<ContactPlain | null>(
        null,
    )
    const [deleteBusy, setDeleteBusy] = useState(false)
    const [deleteErr, setDeleteErr] = useState<string | null>(null)

    const reloadContacts = useCallback(async () => {
        setContacts(await conv.listContacts())
    }, [conv])

    useEffect(() => {
        void (async () => {
            try {
                if (!(await identity.hasIdentity())) {
                    await identity.ensureIdentity("User")
                }

                await identity.ensureCompactIdentity()
            } catch {
                /* ignore */
            }
        })()
    }, [identity])

    useEffect(() => {
        void (async () => {
            setLoading(true)

            try {
                await reloadContacts()
            } finally {
                setLoading(false)
            }
        })()
    }, [reloadContacts])

    if (loading) {
        return (
            <Surface
                className="flex items-center gap-3 rounded-3xl border border-divider p-6"
                variant="secondary"
            >
                <Spinner size="sm" />
                <span className="text-sm text-default-500">
                    {t("common.loading")}
                </span>
            </Surface>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-lg font-semibold tracking-tight">
                    {t("home.title")}
                </h1>
                <div className="flex items-center gap-2 text-xs text-default-500">
                    <MessageCircle className="size-4" aria-hidden />
                    {contacts.length}
                </div>
            </div>

            {contacts.length === 0 ? (
                <Surface className="rounded-3xl p-6" variant="secondary">
                    <p className="text-sm leading-relaxed text-default-500">
                        {t("home.empty")}
                    </p>
                </Surface>
            ) : (
                <Surface className="rounded-3xl p-2" variant="secondary">
                    <ul className="divide-y divide-divider">
                        {contacts.map((c) => (
                            <li
                                key={c.id}
                                className="flex items-stretch gap-1 py-2 pr-1"
                            >
                                <Link
                                    to="/chat/$contactId"
                                    params={{ contactId: c.id }}
                                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-default-100"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">
                                            {c.displayName}
                                        </p>
                                        <p className="truncate text-xs text-default-500">
                                            {t("home.openChat")}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-xs font-medium text-default-500">
                                        →
                                    </span>
                                </Link>
                                <Button
                                    isIconOnly
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0 self-center"
                                    aria-label={t("chat.deleteChat")}
                                    onPress={() => {
                                        setDeleteErr(null)
                                        setPendingDelete(c)
                                    }}
                                >
                                    <Trash2 className="size-4 text-danger" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </Surface>
            )}

            {pendingDelete ? (
                <DeleteChatConfirmModalHeroUI
                    open
                    displayName={pendingDelete.displayName}
                    busy={deleteBusy}
                    error={deleteErr}
                    onOpenChange={(next) => {
                        if (!next) {
                            setPendingDelete(null)
                            setDeleteErr(null)
                        }
                    }}
                    onConfirm={async () => {
                        if (!pendingDelete) {
                            return
                        }

                        setDeleteBusy(true)
                        setDeleteErr(null)

                        try {
                            await conv.deleteContact(pendingDelete.id)
                            setPendingDelete(null)
                            await reloadContacts()
                        } catch (e) {
                            const reason =
                                e instanceof Error ? e.message : String(e)

                            setDeleteErr(
                                t("chat.deleteChatFailed", { reason }),
                            )
                        } finally {
                            setDeleteBusy(false)
                        }
                    }}
                />
            ) : null}
        </div>
    )
}

