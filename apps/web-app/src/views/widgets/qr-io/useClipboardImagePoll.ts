import { useEffect, useState } from "react"

import { clipboardContainsImage } from "@/views/widgets/qr-scanner/clipboard-qr"

/** True when clipboard likely has an image (for enabling Paste QR). */
export function useClipboardImagePoll(): boolean {
    const [hasImage, setHasImage] = useState(false)

    useEffect(() => {
        const refresh = () => {
            void clipboardContainsImage().then(setHasImage)
        }
        refresh()
        const timer = setInterval(refresh, 1200)
        const onVis = () => {
            if (document.visibilityState === "visible") {
                refresh()
            }
        }
        document.addEventListener("visibilitychange", onVis)
        window.addEventListener("focus", refresh)
        return () => {
            clearInterval(timer)
            document.removeEventListener("visibilitychange", onVis)
            window.removeEventListener("focus", refresh)
        }
    }, [])

    return hasImage
}
