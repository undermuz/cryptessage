/**
 * Forces the browser / PWA to pick up newly deployed assets: unregisters
 * service workers, drops Cache Storage entries for this origin, then reloads.
 */
export async function reloadAppForUpdate(): Promise<void> {
    if (import.meta.env.DEV) {
        globalThis.location.reload()

        return
    }

    try {
        if ("serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations()

            await Promise.all(regs.map((r) => r.unregister()))
        }

        if ("caches" in globalThis) {
            const keys = await caches.keys()

            await Promise.all(keys.map((k) => caches.delete(k)))
        }
    } catch {
        // Still try a hard reload below.
    }

    globalThis.location.reload()
}
