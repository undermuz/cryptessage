import {
    createRootRouteWithContext,
    createRoute,
    redirect,
} from "@tanstack/react-router"

import type { AppRouterContext } from "./router-context"
import { RootLayout } from "./layout"
import { UnlockPage } from "./unlock/page"
import { AuthenticatedShell } from "./authenticated/layout"
import { HomePage } from "./home/page"
import { ContactsPage } from "./contacts/page"
import { ChatPage } from "./chat/page"
import { SettingsPage } from "./settings/page"
import { AuthService, type IAuthService } from "@/di/auth/types"

export const root = createRootRouteWithContext<AppRouterContext>()({
    component: RootLayout,
})

export const unlockRoute = createRoute({
    getParentRoute: () => root,
    path: "unlock",
    validateSearch: (raw: Record<string, unknown>): { redirect?: string } => ({
        redirect: typeof raw.redirect === "string" ? raw.redirect : undefined,
    }),
    component: UnlockPage,
    beforeLoad: ({ context }) => {
        const auth = context.di.get<IAuthService>(AuthService)

        if (auth.isUnlocked()) {
            throw redirect({ to: "/" })
        }
    },
})

const authedLayoutRoute = createRoute({
    getParentRoute: () => root,
    id: "authed",
    beforeLoad: ({ context, location }) => {
        const auth = context.di.get<IAuthService>(AuthService)

        if (!auth.isUnlocked()) {
            const back = location.href
            throw redirect({
                to: "/unlock",
                search: { redirect: back },
            })
        }
    },
    component: AuthenticatedShell,
})

export const indexRoute = createRoute({
    getParentRoute: () => authedLayoutRoute,
    path: "/",
    component: HomePage,
})

export const contactsRoute = createRoute({
    getParentRoute: () => authedLayoutRoute,
    path: "contacts",
    component: ContactsPage,
})

export const chatRoute = createRoute({
    getParentRoute: () => authedLayoutRoute,
    path: "chat/$contactId",
    component: ChatPage,
})

export const settingsRoute = createRoute({
    getParentRoute: () => authedLayoutRoute,
    path: "settings",
    component: SettingsPage,
})

const authedTree = authedLayoutRoute.addChildren([
    indexRoute,
    contactsRoute,
    chatRoute,
    settingsRoute,
])

export const routeTree = root.addChildren([unlockRoute, authedTree])
