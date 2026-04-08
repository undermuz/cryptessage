import {
    forwardRef,
    useCallback,
    useEffect,
    useRef,
} from "react"
import QRCode from "qrcode"

function payloadByteLength(payload: string | Uint8Array): number {
    return typeof payload === "string"
        ? new TextEncoder().encode(payload).length
        : payload.byteLength
}

type Props = {
    payload: string | Uint8Array
    onTooLong?: () => void
    onDrawComplete?: () => void
    /** Max encoded size in bytes (byte mode for `Uint8Array`, UTF-8 length for string). */
    maxByteLength: number
}

export const VisitQrCanvas = forwardRef<HTMLCanvasElement, Props>(
    function VisitQrCanvas(
        { payload, onTooLong, onDrawComplete, maxByteLength },
        ref,
    ) {
        const innerRef = useRef<HTMLCanvasElement | null>(null)

        const setCanvasRef = useCallback(
            (el: HTMLCanvasElement | null) => {
                innerRef.current = el

                if (typeof ref === "function") {
                    ref(el)
                } else if (ref) {
                    ref.current = el
                }
            },
            [ref],
        )

        const onDrawCompleteRef = useRef(onDrawComplete)

        onDrawCompleteRef.current = onDrawComplete

        useEffect(() => {
            const canvas = innerRef.current

            if (!canvas) {
                return
            }

            if (payloadByteLength(payload) > maxByteLength) {
                onTooLong?.()
                return
            }

            const qrData =
                typeof payload === "string"
                    ? payload
                    : ([{ data: payload, mode: "byte" }] as const)

            void QRCode.toCanvas(canvas, qrData as unknown as string, {
                width: 240,
                margin: 2,
                errorCorrectionLevel: "M",
            })
                .then(() => {
                    onDrawCompleteRef.current?.()
                })
                .catch(() => {
                    /* invalid length / content */
                })
        }, [payload, maxByteLength, onTooLong])

        return (
            <canvas
                ref={setCanvasRef}
                className="rounded-md border border-border"
            />
        )
    },
)
