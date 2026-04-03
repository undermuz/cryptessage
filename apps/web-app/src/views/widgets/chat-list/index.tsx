import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"

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

export function ChatListWidget() {
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
        return <p className="text-muted-foreground">{t("common.loading")}</p>
    }

    return (
        <div className="space-y-4">
            <h1 className="text-lg font-semibold">{t("home.title")}</h1>
            {contacts.length === 0 ? (
                <p className="text-muted-foreground">{t("home.empty")}</p>
            ) : (
                <ul className="space-y-2">
                    {contacts.map((c) => (
                        <li key={c.id}>
                            <Link
                                to="/chat/$contactId"
                                params={{ contactId: c.id }}
                                className="block rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                            >
                                <span className="font-medium">{c.displayName}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {t("home.openChat")}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
