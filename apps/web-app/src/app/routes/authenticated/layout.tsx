import { useEffect } from "react"
import { Link, Outlet } from "@tanstack/react-router"

import {
    HttpRestInboundCoordinator,
    type IHttpRestInboundCoordinator,
} from "@/di/chat-transport/http-rest/v1/types"
import { useDi } from "@/di/react/hooks/useDi"
import { useT } from "@/di/react/hooks/useT"

export function AuthenticatedShell() {
    const t = useT()
    const httpInbound = useDi<IHttpRestInboundCoordinator>(
        HttpRestInboundCoordinator,
    )

    useEffect(() => {
        void httpInbound.start()

        return () => {
            httpInbound.stop()
        }
    }, [httpInbound])

    const linkCls =
        "text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <header className="border-b border-border px-4 py-3">
                <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-4">
                    <Link to="/" className={linkCls}>
                        {t("nav.chats")}
                    </Link>
                    <Link to="/contacts" className={linkCls}>
                        {t("nav.contacts")}
                    </Link>
                    <Link to="/settings" className={linkCls}>
                        {t("nav.settings")}
                    </Link>
                </nav>
            </header>
            <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
                <Outlet />
            </main>
        </div>
    )
}
