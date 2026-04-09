import type { VisitCardRawPayload } from "@/di/openpgp-crypto/types"
import { VisitQrCanvas } from "@/views/widgets/visit-qr"
import type { ReactNode } from "react"

function payloadByteLength(raw: VisitCardRawPayload): number {
    return typeof raw === "string"
        ? new TextEncoder().encode(raw).length
        : raw.byteLength
}

type Props = {
    title: string
    metaLine: string
    qrPayload: VisitCardRawPayload
    maxQrBytes: number
    tooLongHint: string
    qrKey?: string
    children: ReactNode
}

export function ImportQrPreviewShell({
    title,
    metaLine,
    qrPayload,
    maxQrBytes,
    tooLongHint,
    qrKey,
    children,
}: Props) {
    const canDrawQr = payloadByteLength(qrPayload) <= maxQrBytes

    return (
        <div className="space-y-3 rounded-large border border-divider bg-default-50 p-4 shadow-sm">
            <div className="space-y-0.5">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-xs text-default-500">{metaLine}</p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="shrink-0">
                    {canDrawQr ? (
                        <VisitQrCanvas
                            key={
                                qrKey ??
                                (typeof qrPayload === "string"
                                    ? qrPayload.slice(0, 48)
                                    : `b:${qrPayload.byteLength}:${Array.from(qrPayload.subarray(0, 8)).join(",")}`)
                            }
                            payload={qrPayload}
                            maxByteLength={maxQrBytes}
                        />
                    ) : (
                        <p className="max-w-[240px] text-xs text-default-500">
                            {tooLongHint}
                        </p>
                    )}
                </div>
                <div className="min-w-0 flex-1 space-y-2 text-sm">{children}</div>
            </div>
        </div>
    )
}

