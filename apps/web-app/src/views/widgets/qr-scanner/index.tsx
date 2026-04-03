import { useEffect, useRef, useState } from "react"
import { BrowserQRCodeReader } from "@zxing/browser"

import { Button } from "@/views/ui/button"
import { useT } from "@/di/react/hooks/useT"

type Props = {
    onResult: (text: string) => void
    onClose: () => void
}

export function QrScannerPanel({ onResult, onClose }: Props) {
    const t = useT()
    const videoRef = useRef<HTMLVideoElement>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const video = videoRef.current
        if (!video) {
            return
        }
        const reader = new BrowserQRCodeReader()
        let controls: { stop: () => void } | null = null
        let cancelled = false

        void reader
            .decodeFromVideoDevice(undefined, video, (result, err, c) => {
                if (cancelled) {
                    return
                }
                if (result) {
                    onResult(result.getText())
                    c?.stop()
                }
                if (err && !(err as { name?: string }).name?.includes("NotFound")) {
                    setError(String(err))
                }
            })
            .then((c) => {
                if (!cancelled) {
                    controls = c
                } else {
                    c.stop()
                }
            })
            .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : String(e))
            })

        return () => {
            cancelled = true
            controls?.stop()
        }
    }, [onResult])

    return (
        <div className="space-y-3 rounded-lg border border-border p-3">
            <video
                ref={videoRef}
                className="w-full max-w-sm rounded-md bg-black"
                muted
                playsInline
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="button" variant="outline" onClick={onClose}>
                {t("contacts.stopCamera")}
            </Button>
        </div>
    )
}
