/// <reference lib="webworker" />

import {
    cleanupOutdatedCaches,
    createHandlerBoundToURL,
    precacheAndRoute,
} from "workbox-precaching"
import { NavigationRoute, registerRoute } from "workbox-routing"

declare const self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: (string | { url: string; revision: string | null })[]
}

const defaultNotificationUrl =
    import.meta.env.VITE_ROUTER_HASH === "true" ? "#/" : "./"

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

try {
    const indexUrl = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}index.html`
    const handler = createHandlerBoundToURL(indexUrl)

    registerRoute(new NavigationRoute(handler))
} catch {
    /* precache may omit index in unusual builds */
}

self.addEventListener("install", () => {
    void self.skipWaiting()
})

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim())
})

type PushPayload = {
    title?: string
    body?: string
    url?: string
}

self.addEventListener("push", (event: PushEvent) => {
    let data: PushPayload = {}

    try {
        if (event.data) {
            data = event.data.json() as PushPayload
        }
    } catch {
        const text = event.data?.text()

        data = {
            title: "cryptessage",
            body: text ?? "",
        }
    }

    const title = typeof data.title === "string" && data.title.length > 0
        ? data.title
        : "cryptessage"
    const body =
        typeof data.body === "string" && data.body.length > 0 ? data.body : ""
    const url =
        typeof data.url === "string" && data.url.length > 0
            ? data.url
            : defaultNotificationUrl

    const icon = new URL("pwa-icon.svg", self.registration.scope).href

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon,
            badge: icon,
            data: { url },
        }),
    )
})

self.addEventListener("notificationclick", (event: NotificationEvent) => {
    event.notification.close()

    const raw = event.notification.data as { url?: string } | undefined
    const relative =
        typeof raw?.url === "string" && raw.url.length > 0
            ? raw.url
            : defaultNotificationUrl

    const target = new URL(relative, self.registration.scope).href

    event.waitUntil(
        (async () => {
            const allClients = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            })

            for (const client of allClients) {
                if (
                    client.url.startsWith(self.location.origin) &&
                    "focus" in client
                ) {
                    const wc = client as WindowClient

                    await wc.focus()
                    await wc.navigate(target)
                    return
                }
            }

            await self.clients.openWindow(target)
        })(),
    )
})
