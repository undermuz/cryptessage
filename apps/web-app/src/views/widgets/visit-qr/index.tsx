import { useEffect, useRef } from "react"
import QRCode from "qrcode"

type Props = {
    payload: string
    onTooLong?: () => void
    maxChars: number
}

export function VisitQrCanvas({ payload, onTooLong, maxChars }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) {
            return
        }
        if (payload.length > maxChars) {
            onTooLong?.()
            return
        }
        void QRCode.toCanvas(canvas, payload, {
            width: 240,
            margin: 2,
            errorCorrectionLevel: "M",
        }).catch(() => {
            /* invalid length / content */
        })
    }, [payload, maxChars, onTooLong])

    return <canvas ref={canvasRef} className="rounded-md border border-border" />
}
