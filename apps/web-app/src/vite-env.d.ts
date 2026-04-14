/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
    /** When `"true"`, use hash history (needed for GitHub Pages without SPA fallback). */
    readonly VITE_ROUTER_HASH?: string
    /** From `apps/web-app/package.json` at build time. */
    readonly VITE_APP_VERSION: string
    /** URL-safe base64 VAPID public key for Web Push `subscribe()`. */
    readonly VITE_WEB_PUSH_PUBLIC_KEY?: string
}
