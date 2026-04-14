import { inject, injectable } from "inversify"

import { EnvProvider, type IEnvProvider } from "@/di/env/types"
import type { ILoggerFactory } from "@/di/logger/types"
import type { ILogger } from "@/di/types/logger"
import {
    LocalStorageProvider,
    type ILocalStorage,
} from "@/di/utils/local-storage/types"

import type {
    IPushNotificationsService,
    PushNotificationStatus,
} from "./types"

const PREFS_KEY = "push_notifications_prefs_v1"

type PrefsV1 = {
    v: 1
    /** User wants push enabled; we still require permission + subscription. */
    desired: boolean
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/")
    const raw = atob(base64)
    const out = new Uint8Array(raw.length)

    for (let i = 0; i < raw.length; i++) {
        out[i] = raw.charCodeAt(i)
    }

    return out
}

@injectable()
export class PushNotificationsProvider implements IPushNotificationsService {
    @inject(LocalStorageProvider)
    private readonly storage!: ILocalStorage

    @inject(EnvProvider)
    private readonly env!: IEnvProvider

    private readonly log: ILogger

    constructor(
        @inject("Factory<Logger>")
        loggerFactory: ILoggerFactory,
    ) {
        this.log = loggerFactory("PushNotificationsProvider")
    }

    private readVapidPublicKey(): string | undefined {
        const v = this.env.get<string>("WEB_PUSH_PUBLIC_KEY")

        return v && v.length > 0 ? v : undefined
    }

    private async readPrefs(): Promise<PrefsV1> {
        const raw = await this.storage.getItem(PREFS_KEY)

        if (!raw) {
            return { v: 1, desired: false }
        }

        try {
            const j = JSON.parse(raw) as Partial<PrefsV1>

            return { v: 1, desired: j.desired === true }
        } catch {
            return { v: 1, desired: false }
        }
    }

    private async writePrefs(prefs: PrefsV1): Promise<void> {
        await this.storage.setItem(PREFS_KEY, JSON.stringify(prefs))
    }

    private computeSupported(): boolean {
        if (typeof window === "undefined") {
            return false
        }

        if (!window.isSecureContext) {
            return false
        }

        return (
            "serviceWorker" in navigator &&
            "PushManager" in window &&
            "Notification" in window
        )
    }

    public async getStatus(): Promise<PushNotificationStatus> {
        const supported = this.computeSupported()
        const configured = Boolean(this.readVapidPublicKey())

        if (!supported) {
            return {
                supported: false,
                configured,
                permission: "unsupported",
                subscribed: false,
            }
        }

        const permission = Notification.permission

        try {
            const reg = await navigator.serviceWorker.getRegistration()
            const sub = await reg?.pushManager.getSubscription()

            return {
                supported: true,
                configured,
                permission,
                subscribed: Boolean(sub),
            }
        } catch (e) {
            this.log.warn("getStatus failed: error={error}", { error: e })

            return {
                supported: true,
                configured,
                permission,
                subscribed: false,
            }
        }
    }

    public async initialize(): Promise<void> {
        const prefs = await this.readPrefs()

        if (!prefs.desired) {
            return
        }

        const key = this.readVapidPublicKey()

        if (!key || !this.computeSupported()) {
            return
        }

        if (Notification.permission !== "granted") {
            return
        }

        try {
            const reg = await navigator.serviceWorker.ready
            const sub = await reg.pushManager.getSubscription()

            if (sub) {
                return
            }

            await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(key),
            })
        } catch (e) {
            this.log.warn("initialize failed: error={error}", {
                error: e,
            })
        }
    }

    public async enable(): Promise<void> {
        const key = this.readVapidPublicKey()

        if (!key) {
            throw new Error("WEB_PUSH_PUBLIC_KEY_MISSING")
        }

        if (!this.computeSupported()) {
            throw new Error("PUSH_NOT_SUPPORTED")
        }

        const perm = await Notification.requestPermission()

        if (perm !== "granted") {
            throw new Error("NOTIFICATION_PERMISSION_DENIED")
        }

        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()

        if (existing) {
            await this.writePrefs({ v: 1, desired: true })
            return
        }

        await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
        })

        await this.writePrefs({ v: 1, desired: true })
    }

    public async disable(): Promise<void> {
        await this.writePrefs({ v: 1, desired: false })

        if (!this.computeSupported()) {
            return
        }

        try {
            const reg = await navigator.serviceWorker.getRegistration()
            const sub = await reg?.pushManager.getSubscription()

            if (sub) {
                await sub.unsubscribe()
            }
        } catch (e) {
            this.log.warn("disable unsubscribe failed: error={error}", {
                error: e,
            })
        }
    }

    public async showTestNotification(): Promise<void> {
        if (!this.computeSupported()) {
            throw new Error("PUSH_NOT_SUPPORTED")
        }

        if (Notification.permission !== "granted") {
            throw new Error("NOTIFICATION_PERMISSION_DENIED")
        }

        const reg = await navigator.serviceWorker.ready
        const icon = new URL("pwa-icon.svg", reg.scope).href
        const defaultUrl =
            import.meta.env.VITE_ROUTER_HASH === "true" ? "#/" : "./"

        await reg.showNotification("cryptessage", {
            body: "Test notification",
            icon,
            badge: icon,
            data: { url: defaultUrl },
        })
    }
}
