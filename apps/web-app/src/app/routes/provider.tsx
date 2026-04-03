import { useEffect } from "react"
import {
    createRouter,
    RouterProvider as TanStackRouterProvider,
} from "@tanstack/react-router"
import type { Container } from "inversify"

import { routeTree } from "./index"
import { CryptDbProvider, type CryptDbService } from "@/di/crypt-db/types"
import useConstant from "@/di/react/hooks/useConstant"
import { useDiContainer } from "@/di/react/hooks/useDiContainer"

const createAppRouter = () =>
    createRouter({
        routeTree,
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
