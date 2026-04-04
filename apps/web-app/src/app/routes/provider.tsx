import { useEffect } from "react"
import { createHashHistory } from "@tanstack/history"
import {
    createRouter,
    RouterProvider as TanStackRouterProvider,
} from "@tanstack/react-router"
import type { Container } from "inversify"

import { routeTree } from "./index"
import { CryptDbProvider, type CryptDbService } from "@/di/crypt-db/types"
import useConstant from "@/di/react/hooks/useConstant"
import { useDiContainer } from "@/di/react/hooks/useDiContainer"

const routerBasepath =
    import.meta.env.BASE_URL.replace(/\/$/, "") || "/"

const useHashRouter = import.meta.env.VITE_ROUTER_HASH === "true"

/** Hash history: document path is already `/<repo>/`; hash must be `#/contacts`, not `#/<repo>/contacts`. */
const resolvedBasepath = useHashRouter ? "/" : routerBasepath

const createAppRouter = () =>
    createRouter({
        routeTree,
        basepath: resolvedBasepath,
        ...(useHashRouter ? { history: createHashHistory() } : {}),
        context: { di: undefined as unknown as Container },
        defaultPreload: "intent",
        scrollRestoration: true,
    })

export type AppRouter = ReturnType<typeof createAppRouter>

declare module "@tanstack/react-router" {
    interface Register {
        router: AppRouter
    }
}

export function RouterProvider() {
    const di = useDiContainer()
    const router = useConstant(() => createAppRouter())

    useEffect(() => {
        void di.get<CryptDbService>(CryptDbProvider).open()
    }, [di])

    return (
        <TanStackRouterProvider router={router} context={{ di }} />
    )
}
