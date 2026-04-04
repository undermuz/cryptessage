import { useCallback, useEffect, useState } from "react"
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
    type VisitCardRawPayload,
} from "@/di/openpgp-crypto/types"
import {
    IdentityService,
    type IIdentityService,
} from "@/di/identity/types"
import type { ContactPlain } from "@/di/crypt-db/types-data"
import { QR_VISIT_CARD_MAX_BYTES } from "@/di/secure/constants"
import {
    ExportQrBlock,
    type ExportQrLabels,
} from "@/views/widgets/qr-io/export-qr-block"
import { ImportQrBlock } from "@/views/widgets/qr-io/import-qr-block"
import { ImportQrPreviewShell } from "@/views/widgets/qr-io/import-qr-preview-shell"
import { useClipboardImagePoll } from "@/views/widgets/qr-io/useClipboardImagePoll"
import {
    decodeQrFromClipboardImage,
} from "@/views/widgets/qr-scanner/clipboard-qr"

type PendingQrSource = "camera" | "clipboard"

function visitPayloadByteLength(raw: VisitCardRawPayload): number {
    return typeof raw === "string"
        ? new TextEncoder().encode(raw).length
        : raw.byteLength
}

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
    const [cardPayload, setCardPayload] = useState<Uint8Array | null>(null)
    const [cardJson, setCardJson] = useState<string | null>(null)
    const [msg, setMsg] = useState<string | null>(null)

    const [pendingQr, setPendingQr] = useState<{
        raw: VisitCardRawPayload
        source: PendingQrSource
    } | null>(null)
    const [preview, setPreview] = useState<QrPreviewInfo | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)

    const clipboardImage = useClipboardImagePoll()
    const [pasteBusy, setPasteBusy] = useState(false)

    const exportLabels: ExportQrLabels = {
        showQr: t("contacts.showQr"),
        hideQr: t("contacts.hideQr"),
        copyQrImage: t("contacts.copyQr"),
        shareQr: t("contacts.shareQr"),
        copyArmored: t("contacts.copyVisitCardJson"),
        copyQrUnavailable: t("contacts.copyQrUnavailable"),
        copyQrFail: (reason) => t("contacts.copyQrFail", { reason }),
        copyQrOk: t("contacts.copyQrOk"),
        copyArmoredOk: t("contacts.copyVisitCardJsonOk"),
        shareUnavailable: t("contacts.shareUnavailable"),
        shareFail: (reason) => t("contacts.shareFail", { reason }),
    }

    const buildPreview = useCallback(
        async (raw: VisitCardRawPayload): Promise<QrPreviewInfo> => {
            try {
                const parsed = await pgp.parseVisitCard(raw)
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

    const reload = async () => {
        setContacts(await conv.listContacts())
    }

    useEffect(() => {
        void reload()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
    }, [])

    const buildCard = async () => {
        const name = await identity.getSelfDisplayName()
        const raw = await pgp.buildVisitCardBinary(name)
        const json = await pgp.buildVisitCard(name)
        setCardPayload(raw)
        setCardJson(json)
    }

    useEffect(() => {
        if (!showMyQr) {
            setCardPayload(null)
            setCardJson(null)
            return
        }
        void buildCard()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- toggle + DI singletons
    }, [showMyQr])

    const addFromRaw = async (raw: VisitCardRawPayload): Promise<boolean> => {
        setMsg(null)
        try {
            await conv.addContactFromVisitCard(
                typeof raw === "string" ? raw.trim() : raw,
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
            const payload = await decodeQrFromClipboardImage(reader)
            if (!payload) {
                setMsg(t("contacts.pasteQrNoCode"))
                return
            }
            setPendingQr({ raw: payload, source: "clipboard" })
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

            <ExportQrBlock
                heading={t("contacts.yourCard")}
                labels={exportLabels}
                expanded={showMyQr}
                onExpandedChange={setShowMyQr}
                payloadLoading={showMyQr && !cardPayload}
                qrPayload={cardPayload}
                maxByteLength={QR_VISIT_CARD_MAX_BYTES}
                armoredText={cardJson ?? ""}
                onNotify={setMsg}
                footer={
                    cardPayload ? (
                        <p className="text-xs text-muted-foreground">
                            {t("qr.visitCardBinaryMax")}:{" "}
                            {QR_VISIT_CARD_MAX_BYTES}
                        </p>
                    ) : undefined
                }
                shareFileName="cryptessage-visit-qr.png"
                shareTitle="cryptessage visit card"
            />

            <ImportQrBlock
                heading={t("contacts.addVisitCardSection")}
                labels={{
                    scan: t("contacts.addQr"),
                    pasteFromImage: t("contacts.pasteQr"),
                    armoredSectionTitle: t("contacts.addPaste"),
                    armoredSubmit: t("contacts.addBtn"),
                }}
                armoredPlaceholder="JSON visit card, or full -----BEGIN PGP PUBLIC KEY BLOCK----- (not fingerprint hex)"
                armoredValue={paste}
                onArmoredChange={setPaste}
                onArmoredSubmit={() => void addFromRaw(paste)}
                armoredSubmitDisabled={!paste.trim()}
                hasClipboardImage={clipboardImage}
                pasteBusy={pasteBusy}
                scanOpen={scan}
                onOpenScan={() => setScan(true)}
                onCloseScan={() => setScan(false)}
                onPasteQrFromImage={() => void onPasteQrFromClipboard()}
                onScannedPayload={(payload) =>
                    setPendingQr({ raw: payload, source: "camera" })
                }
                nameHint={{
                    label: t("contacts.nameHint"),
                    value: nameHint,
                    onChange: setNameHint,
                }}
                preview={
                    pendingQr ? (
                        <ImportQrPreviewShell
                            title={t("contacts.reviewTitle")}
                            metaLine={`${
                                pendingQr.source === "camera"
                                    ? t("contacts.reviewSourceCamera")
                                    : t("contacts.reviewSourceClipboard")
                            } · ${t("contacts.reviewPayloadSize", {
                                n: visitPayloadByteLength(pendingQr.raw),
                            })}`}
                            qrPayload={pendingQr.raw}
                            maxQrBytes={QR_VISIT_CARD_MAX_BYTES}
                            tooLongHint={t("contacts.reviewQrTooLong")}
                        >
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
                                                {t("contacts.reviewDisplayName")}
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
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <Button
                                            type="button"
                                            disabled={
                                                previewLoading || !preview?.valid
                                            }
                                            onClick={() =>
                                                void confirmAddPending()
                                            }
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
                                </>
                            )}
                        </ImportQrPreviewShell>
                    ) : undefined
                }
            />

            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

            <section>
                <h2 className="mb-2 text-sm font-medium">{t("home.title")}</h2>
                {contacts.length === 0 ? (
                    <p className="text-muted-foreground">
                        {t("contacts.listEmpty")}
                    </p>
                ) : (
                    <ul className="space-y-1 text-sm">
                        {contacts.map((c) => (
                            <li
                                key={c.id}
                                className="rounded border border-border px-2 py-1"
                            >
                                {c.displayName}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}
