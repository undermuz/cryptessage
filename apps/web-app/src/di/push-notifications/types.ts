import type { Initializable } from "@/di/types/initializable"

export const PushNotificationsService = Symbol.for("PushNotificationsService")

export type PushNotificationStatus = {
    /** Secure context, service worker, Push API, and Notification API available */
    supported: boolean
    /** `VITE_WEB_PUSH_PUBLIC_KEY` is set (VAPID public key for subscribe) */
    configured: boolean
    permission: NotificationPermission | "unsupported"
    subscribed: boolean
}

export type IPushNotificationsService = Initializable<void, []> & {
    getStatus(): Promise<PushNotificationStatus>
    /** Requests permission (if needed), subscribes to push, persists preference. */
    enable(): Promise<void>
    /** Unsubscribes and clears preference. */
    disable(): Promise<void>
    /** Local notification while the app is open (or from a user gesture). */
    showTestNotification(): Promise<void>
}
