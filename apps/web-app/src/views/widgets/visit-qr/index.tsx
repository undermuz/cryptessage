import {
    forwardRef,
    useCallback,
    useEffect,
    useRef,
} from "react"
import QRCode from "qrcode"

type Props = {
    payload: string
    onTooLong?: () => void
    onDrawComplete?: () => void
    maxChars: number
}

export const VisitQrCanvas = forwardRef<HTMLCanvasElement, Props>(
    function VisitQrCanvas(
        { payload, onTooLong, onDrawComplete, maxChars },
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
            if (payload.length > maxChars) {
                onTooLong?.()
                return
            }
            void QRCode.toCanvas(canvas, payload, {
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
        }, [payload, maxChars, onTooLong])

        return (
            <canvas
                ref={setCanvasRef}
                className="rounded-md border border-border"
            />
        )
    },
)
