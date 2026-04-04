import { useCallback, useEffect, useRef, useState } from "react"
import { BrowserQRCodeReader } from "@zxing/browser"

import { Button } from "@/views/ui/button"
import { useT } from "@/di/react/hooks/useT"
import { useDi } from "@/di/react/hooks/useDi"
import {
    ConversationService,
    type IConversationService,
} from "@/di/conversation/types"
import {
    OpenPgpCryptoService,
    type IOpenPgpCryptoService,
} from "@/di/openpgp-crypto/types"
import {
    IdentityService,
    type IIdentityService,
} from "@/di/identity/types"
import type { ContactPlain } from "@/di/crypt-db/types-data"
import { QR_PAYLOAD_MAX_CHARS } from "@/di/secure/constants"
import { VisitQrCanvas } from "@/views/widgets/visit-qr"
import { QrScannerPanel } from "@/views/widgets/qr-scanner"
import {
    clipboardContainsImage,
    decodeQrFromClipboardImage,
} from "@/views/widgets/qr-scanner/clipboard-qr"

type PendingQrSource = "camera" | "clipboard"

type QrPreviewInfo = {
    valid: boolean
    detail: string
    displayName: string | null
    publicKeyArmored: string | null
}

export function ContactsWidget() {
    const t = useT()
    const conv = useDi<IConversationService>(ConversationService)
    const pgp = useDi<IOpenPgpCryptoService>(OpenPgpCryptoService)
    const identity = useDi<IIdentityService>(IdentityService)

    const [contacts, setContacts] = useState<ContactPlain[]>([])
    const [paste, setPaste] = useState("")
    const [nameHint, setNameHint] = useState("")
    const [scan, setScan] = useState(false)
    const [showMyQr, setShowMyQr] = useState(false)
    const [cardPayload, setCardPayload] = useState("")
    const [msg, setMsg] = useState<string | null>(null)
    const visitQrCanvasRef = useRef<HTMLCanvasElement>(null)
    const [visitQrReady, setVisitQrReady] = useState(false)

    const [pendingQr, setPendingQr] = useState<{
        raw: string
        source: PendingQrSource
    } | null>(null)
    const [preview, setPreview] = useState<QrPreviewInfo | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)

    const [clipboardImage, setClipboardImage] = useState(false)
    const [pasteBusy, setPasteBusy] = useState(false)

    const buildPreview = useCallback(
        async (raw: string): Promise<QrPreviewInfo> => {
            try {
                const parsed = pgp.parseVisitCard(raw.trim())
                await pgp.validatePublicKeyArmored(parsed.publicKeyArmored)
                return {
                    valid: true,
                    detail: t("contacts.reviewKeyValid"),
                    displayName: parsed.displayName.trim() || null,
                    publicKeyArmored: parsed.publicKeyArmored.trim(),
                }
            } catch (e) {
                return {
                    valid: false,
                    detail: e instanceof Error ? e.message : String(e),
                    displayName: null,
                    publicKeyArmored: null,
                }
            }
        },
        [pgp, t],
    )

    useEffect(() => {
        if (!pendingQr) {
            setPreview(null)
            setPreviewLoading(false)
            return
        }
        let cancelled = false
        setPreviewLoading(true)
        setPreview(null)
        void buildPreview(pendingQr.raw).then((info) => {
            if (!cancelled) {
                setPreview(info)
                setPreviewLoading(false)
            }
        })
        return () => {
            cancelled = true
        }
    }, [pendingQr, buildPreview])

    useEffect(() => {
        const refresh = () => {
            void clipboardContainsImage().then(setClipboardImage)
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

    const reload = async () => {
        setContacts(await conv.listContacts())
    }

    useEffect(() => {
        void reload()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
    }, [])

    const buildCard = async () => {
        const name = await identity.getSelfDisplayName()
        const raw = await pgp.buildVisitCard(name)
        setCardPayload(raw)
    }

    useEffect(() => {
        if (showMyQr) {
            void buildCard()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- toggle + DI singletons
    }, [showMyQr])

    useEffect(() => {
        setVisitQrReady(false)
    }, [cardPayload])

    useEffect(() => {
        if (!showMyQr) {
            setVisitQrReady(false)
        }
    }, [showMyQr])

    const copyVisitQrImage = () => {
        const canvas = visitQrCanvasRef.current
        if (!canvas || !visitQrReady) {
            setMsg(t("contacts.copyQrUnavailable"))
            return
        }
        setMsg(null)
        canvas.toBlob(async (blob) => {
            if (!blob || !navigator.clipboard?.write) {
                setMsg(t("contacts.copyQrFail", { reason: "clipboard" }))
                return
            }
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ "image/png": blob }),
                ])
                setMsg(t("contacts.copyQrOk"))
            } catch (e) {
                const reason = e instanceof Error ? e.message : String(e)
                setMsg(t("contacts.copyQrFail", { reason }))
            }
        }, "image/png")
    }

    const shareVisitQrImage = () => {
        const canvas = visitQrCanvasRef.current
        if (!canvas || !visitQrReady) {
            setMsg(t("contacts.shareUnavailable"))
            return
        }
        setMsg(null)
        canvas.toBlob(async (blob) => {
            if (!blob) {
                setMsg(t("contacts.shareFail", { reason: "empty image" }))
                return
            }
            const file = new File([blob], "cryptessage-visit-qr.png", {
                type: "image/png",
            })
            if (!navigator.share) {
                setMsg(t("contacts.shareUnavailable"))
                return
            }
            if (
                typeof navigator.canShare === "function" &&
                !navigator.canShare({ files: [file] })
            ) {
                setMsg(t("contacts.shareUnavailable"))
                return
            }
            try {
                await navigator.share({
                    files: [file],
                    title: "cryptessage visit card",
                })
            } catch (e) {
                if (e instanceof Error && e.name === "AbortError") {
                    return
                }
                const reason = e instanceof Error ? e.message : String(e)
                setMsg(t("contacts.shareFail", { reason }))
            }
        }, "image/png")
    }

    const addFromRaw = async (raw: string): Promise<boolean> => {
        setMsg(null)
        try {
            await conv.addContactFromVisitCard(
                raw.trim(),
                nameHint.trim() || undefined,
            )
            setPaste("")
            setNameHint("")
            await reload()
            setMsg(t("contacts.addOk"))
            return true
        } catch (e) {
            console.error("[contacts] addContactFromVisitCard", e)
            const reason = e instanceof Error ? e.message : String(e)
            setMsg(t("contacts.addFailed", { reason }))
            return false
        }
    }

    const discardPendingQr = () => {
        setPendingQr(null)
        setPreview(null)
    }

    const onPasteQrFromClipboard = async () => {
        setPasteBusy(true)
        setMsg(null)
        try {
            const reader = new BrowserQRCodeReader()
            const text = await decodeQrFromClipboardImage(reader)
            if (!text) {
                setMsg(t("contacts.pasteQrNoCode"))
                return
            }
            setPendingQr({ raw: text, source: "clipboard" })
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)
            setMsg(t("contacts.pasteQrFailed", { reason }))
        } finally {
            setPasteBusy(false)
        }
    }

    const confirmAddPending = async () => {
        if (!pendingQr) {
            return
        }
        const ok = await addFromRaw(pendingQr.raw)
        if (ok) {
            discardPendingQr()
        }
    }

    return (
        <div className="space-y-6">
            <h1 className="text-lg font-semibold">{t("contacts.title")}</h1>

            <section className="space-y-2 rounded-lg border border-border p-4">
                <h2 className="text-sm font-medium">{t("contacts.yourCard")}</h2>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMyQr((v) => !v)}
                >
                    {showMyQr ? t("contacts.hideQr") : t("contacts.showQr")}
                </Button>
                {showMyQr && cardPayload && (
                    <div className="mt-2 space-y-2">
                        <VisitQrCanvas
                            ref={visitQrCanvasRef}
                            payload={cardPayload}
                            maxChars={QR_PAYLOAD_MAX_CHARS}
                            onDrawComplete={() => setVisitQrReady(true)}
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={!visitQrReady}
                                onClick={() => copyVisitQrImage()}
                            >
                                {t("contacts.copyQr")}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={!visitQrReady}
                                onClick={() => shareVisitQrImage()}
                            >
                                {t("contacts.shareQr")}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t("qr.maxChars")}: {QR_PAYLOAD_MAX_CHARS}
                        </p>
                    </div>
                )}
            </section>

            <section className="space-y-3 rounded-lg border border-border p-4">
                <h2 className="text-sm font-medium">{t("contacts.addQr")}</h2>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        disabled={scan}
                        onClick={() => setScan(true)}
                    >
                        {t("contacts.addQr")}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={scan || !clipboardImage || pasteBusy}
                        onClick={() => void onPasteQrFromClipboard()}
                    >
                        {t("contacts.pasteQr")}
                    </Button>
                </div>
                {scan && (
                    <QrScannerPanel
                        onResult={(text) => {
                            setScan(false)
                            setPendingQr({ raw: text, source: "camera" })
                        }}
                        onClose={() => setScan(false)}
                    />
                )}

                {pendingQr && (
                    <div className="space-y-3 rounded-lg border border-primary/30 bg-muted/20 p-4">
                        <h3 className="text-sm font-medium">
                            {t("contacts.reviewTitle")}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {pendingQr.source === "camera"
                                ? t("contacts.reviewSourceCamera")
                                : t("contacts.reviewSourceClipboard")}
                            {" · "}
                            {t("contacts.reviewPayloadSize", {
                                n: pendingQr.raw.length,
                            })}
                        </p>

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <div className="shrink-0">
                                {pendingQr.raw.length <= QR_PAYLOAD_MAX_CHARS ? (
                                    <VisitQrCanvas
                                        key={pendingQr.raw}
                                        payload={pendingQr.raw}
                                        maxChars={QR_PAYLOAD_MAX_CHARS}
                                    />
                                ) : (
                                    <p className="max-w-[240px] text-xs text-muted-foreground">
                                        {t("contacts.reviewQrTooLong")}
                                    </p>
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-2 text-sm">
                                {previewLoading && (
                                    <p className="text-muted-foreground">
                                        {t("common.loading")}
                                    </p>
                                )}
                                {!previewLoading && preview && (
                                    <>
                                        <p
                                            className={
                                                preview.valid
                                                    ? "font-medium text-emerald-700 dark:text-emerald-400"
                                                    : "font-medium text-destructive"
                                            }
                                        >
                                            {preview.valid
                                                ? t("contacts.reviewValid")
                                                : t("contacts.reviewInvalid")}
                                        </p>
                                        {preview.displayName && (
                                            <p>
                                                <span className="text-muted-foreground">
                                                    {t(
                                                        "contacts.reviewDisplayName",
                                                    )}
                                                    :&nbsp;
                                                </span>
                                                {preview.displayName}
                                            </p>
                                        )}
                                        <p className="whitespace-pre-wrap break-words text-muted-foreground">
                                            {preview.detail}
                                        </p>
                                        {preview.publicKeyArmored && (
                                            <label className="block text-xs text-muted-foreground">
                                                {t("contacts.reviewPublicKey")}
                                                <textarea
                                                    readOnly
                                                    spellCheck={false}
                                                    className="mt-1 max-h-64 min-h-[140px] w-full resize-y rounded-md border border-input bg-muted/50 px-3 py-2 font-mono text-xs leading-snug text-foreground"
                                                    value={preview.publicKeyArmored}
                                                />
                                            </label>
                                        )}
                                    </>
                                )}
                                <label className="block text-xs text-muted-foreground">
                                    {t("contacts.nameHint")}
                                    <input
                                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                                        value={nameHint}
                                        onChange={(e) =>
                                            setNameHint(e.target.value)
                                        }
                                    />
                                </label>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <Button
                                        type="button"
                                        disabled={
                                            previewLoading ||
                                            !preview?.valid
                                        }
                                        onClick={() => void confirmAddPending()}
                                    >
                                        {t("contacts.addContactConfirm")}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={discardPendingQr}
                                    >
                                        {t("contacts.discardReview")}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <section className="space-y-3 rounded-lg border border-border p-4">
                <h2 className="text-sm font-medium">{t("contacts.addPaste")}</h2>
                <textarea
                    className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                    placeholder="JSON visit card, or full -----BEGIN PGP PUBLIC KEY BLOCK----- (not fingerprint hex)"
                />
                <input
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={nameHint}
                    onChange={(e) => setNameHint(e.target.value)}
                    placeholder={t("contacts.nameHint")}
                />
                <Button
                    type="button"
                    disabled={!paste.trim()}
                    onClick={() => void addFromRaw(paste)}
                >
                    {t("contacts.addBtn")}
                </Button>
            </section>

            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

            <section>
                <h2 className="mb-2 text-sm font-medium">{t("home.title")}</h2>
                {contacts.length === 0 ? (
                    <p className="text-muted-foreground">{t("contacts.listEmpty")}</p>
                ) : (
                    <ul className="space-y-1 text-sm">
                        {contacts.map((c) => (
                            <li key={c.id} className="rounded border border-border px-2 py-1">
                                {c.displayName}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}
