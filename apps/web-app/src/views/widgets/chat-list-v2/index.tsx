import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { MessageCircle } from "lucide-react"

import { Spinner, Surface } from "@heroui/react"

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

export function ChatListWidgetHeroUI() {
    const t = useT()
    const conv = useDi<IConversationService>(ConversationService)
    const identity = useDi<IIdentityService>(IdentityService)

    const [contacts, setContacts] = useState<ContactPlain[]>([])
    const [loading, setLoading] = useState(true)

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
                setContacts(await conv.listContacts())
            } finally {
                setLoading(false)
            }
        })()
    }, [conv])

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
                            <li key={c.id} className="py-2">
                                <Link
                                    to="/chat/$contactId"
                                    params={{ contactId: c.id }}
                                    className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-default-100"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">
                                            {c.displayName}
                                        </p>
                                        <p className="truncate text-xs text-default-500">
                                            {t("home.openChat")}
                                        </p>
                                    </div>
                                    <span className="text-xs font-medium text-default-500">
                                        →
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Surface>
            )}
        </div>
    )
}

