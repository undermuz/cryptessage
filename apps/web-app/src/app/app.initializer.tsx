"use client"

import { type FC, type PropsWithChildren, use } from "react"
import { QueryClientProvider } from "@tanstack/react-query"

import { AppProvider, type IAppProvider } from "@/di/app/types"
import useConstant from "@/di/react/hooks/useConstant"
import { useDiContainer } from "@/di/react/hooks/useDiContainer"

export const Bootstrap = () => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
            <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
    )
}

export const AppInitializer: FC<PropsWithChildren> = ({ children }) => {
    const di = useDiContainer()
    const app = di.get<IAppProvider>(AppProvider)
    const initPromise = useConstant(() => app.initialize())

    use(initPromise)

    return (
        <QueryClientProvider client={app.queryClient}>{children}</QueryClientProvider>
    )
}
