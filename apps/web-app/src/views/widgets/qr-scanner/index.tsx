import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react"
import { BrowserQRCodeReader } from "@zxing/browser"
import { NotFoundException } from "@zxing/library"

import { Button } from "@/views/ui/button"
import { useT } from "@/di/react/hooks/useT"

const LOG_PREFIX = "[qr-scanner]"

type Props = {
    onResult: (text: string) => void
    onClose: () => void
}

function pushDebugLog(
    setLines: Dispatch<SetStateAction<string[]>>,
    message: string,
    extra?: Record<string, unknown>,
): void {
    const stamp = new Date().toISOString().slice(11, 19)
    const suffix = extra !== undefined ? ` ${JSON.stringify(extra)}` : ""
    const line = `${stamp} ${message}${suffix}`
    console.debug(LOG_PREFIX, message, extra ?? "")
    setLines((prev) => [...prev.slice(-35), line])
}

export function QrScannerPanel({ onResult, onClose }: Props) {
    const t = useT()
    const videoRef = useRef<HTMLVideoElement>(null)
    const onResultRef = useRef(onResult)
    onResultRef.current = onResult

    const [error, setError] = useState<string | null>(null)
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
    const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
    const [logLines, setLogLines] = useState<string[]>([])

    const lastNotFoundLogAt = useRef(0)

    const appendLog = useCallback(
        (message: string, extra?: Record<string, unknown>) => {
            pushDebugLog(setLogLines, message, extra)
        },
        [],
    )

    useEffect(() => {
        appendLog("panel opened")
        let cancelled = false
        void BrowserQRCodeReader.listVideoInputDevices()
            .then((list) => {
                if (cancelled) {
                    return
                }
                setDevices(list)
                appendLog("cameras enumerated", {
                    count: list.length,
                    labels: list.map((d) => d.label || d.deviceId.slice(0, 8)),
                })
                setDeviceId((prev) => prev ?? list[0]?.deviceId)
            })
            .catch((e: unknown) => {
                appendLog("camera list failed", {
                    error: e instanceof Error ? e.message : String(e),
                })
            })
        return () => {
            cancelled = true
        }
    }, [appendLog])

    useEffect(() => {
        const video = videoRef.current
        if (!video) {
            return
        }
        const reader = new BrowserQRCodeReader()
        let controls: { stop: () => void } | null = null
        let cancelled = false

        appendLog("starting video decode", {
            deviceId: deviceId ?? "default",
        })

        const handleDecoded = (text: string, stop: () => void) => {
            stop()
            appendLog("QR symbol decoded", {
                length: text.length,
                preview: text.slice(0, 80),
            })
            onResultRef.current(text)
        }

        void reader
            .decodeFromVideoDevice(deviceId, video, (result, err, c) => {
                if (cancelled) {
                    return
                }
                if (result) {
                    const text = result.getText()
                    handleDecoded(text, () => c?.stop())
                    return
                }
                if (!err) {
                    return
                }
                if (err instanceof NotFoundException) {
                    const now = Date.now()
                    if (now - lastNotFoundLogAt.current >= 2500) {
                        lastNotFoundLogAt.current = now
                        appendLog("frame decoded: no QR in image (NotFound)")
                    }
                    return
                }
                appendLog("decode error", {
                    name: err instanceof Error ? err.name : typeof err,
                    message: String(err),
                })
                setError(String(err))
            })
            .then((c) => {
                if (!cancelled) {
                    controls = c
                } else {
                    c.stop()
                }
            })
            .catch((e: unknown) => {
                const msg = e instanceof Error ? e.message : String(e)
                appendLog("decodeFromVideoDevice failed", { message: msg })
                setError(msg)
            })

        return () => {
            cancelled = true
            controls?.stop()
        }
    }, [deviceId, appendLog])

    return (
        <div className="space-y-3 rounded-lg border border-border p-3">
            {devices.length > 0 && (
                <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">
                        {t("contacts.cameraLabel")}
                    </span>
                    <select
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={deviceId ?? ""}
                        onChange={(e) =>
                            setDeviceId(e.target.value || undefined)
                        }
                    >
                        {devices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                                {d.label?.trim() || d.deviceId.slice(0, 12)}
                            </option>
                        ))}
                    </select>
                </label>
            )}
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
            <details className="rounded-md border border-border bg-muted/30 p-2 text-xs">
                <summary className="cursor-pointer font-medium">
                    {t("contacts.scanLog")}
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[0.65rem] leading-snug text-muted-foreground">
                    {logLines.join("\n")}
                </pre>
            </details>
        </div>
    )
}
