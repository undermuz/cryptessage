import { useEffect, useState } from "react"

import {
    clipboardAsyncReadPollWorks,
    clipboardContainsImage,
    isIosLikeDevice,
} from "@/views/widgets/qr-scanner/clipboard-qr"

/**
 * Desktop: reflects clipboard image probe (enables “Paste QR” when an image is likely present).
 * iOS / iPadOS: always true — async clipboard read only works on tap; polling would stay false.
 */
export function useClipboardImagePoll(): boolean {
    const [hasImage, setHasImage] = useState(() =>
        isIosLikeDevice() ? true : false,
    )

    useEffect(() => {
        if (!clipboardAsyncReadPollWorks()) {
            if (!isIosLikeDevice()) {
                setHasImage(false)
            }
            return
        }

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
