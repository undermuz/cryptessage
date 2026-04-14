import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { BrowserQRCodeReader } from "@zxing/browser"
import { CheckCircle2, Contact2, XCircle } from "lucide-react"

import type { Key } from "@heroui/react"
import {
    Button,
    Disclosure,
    Spinner,
    Surface,
    Tabs,
    TextArea,
} from "@heroui/react"

import { useT } from "@/di/react/hooks/useT"
import { useDi } from "@/di/react/hooks/useDi"
import type { CryptoProtocolId } from "@/di/crypt-db/crypto-protocol"
import {
    decodeVisitCardV1,
    isCompactVisitCardV1,
} from "@/di/compact-crypto/visit-card"
import {
    CryptoPrefsService,
    type ICryptoPrefsService,
} from "@/di/crypto-prefs/types"
import {
    ConversationService,
    type IConversationService,
    type VisitCardInterpretation,
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
import { bytesToBase64, base64ToBytes } from "@/di/secure/encoding"
import { QR_VISIT_CARD_MAX_BYTES } from "@/di/secure/constants"
import {
    ExportQrBlock,
    type ExportQrLabels,
} from "@/views/widgets/qr-io-v2/export-qr-block"
import { ImportQrBlock } from "@/views/widgets/qr-io-v2/import-qr-block"
import { ImportQrPreviewShell } from "@/views/widgets/qr-io-v2/import-qr-preview-shell"
import {
    decodeQrFromClipboardImage,
    decodeQrFromImageBlob,
} from "@/lib/qr-zxing/clipboard-qr"

type PendingQrSource = "camera" | "clipboard" | "file"

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
    detectedProtocol: CryptoProtocolId | null
    compactKeyPreview: string | null
}

function toCompactBytes(raw: VisitCardRawPayload): Uint8Array | null {
    if (typeof raw !== "string") {
        return raw
    }

    try {
        return base64ToBytes(raw.trim())
    } catch {
        return null
    }
}

export function ContactsWidget() {
    const t = useT()
    const conv = useDi<IConversationService>(ConversationService)
    const pgp = useDi<IOpenPgpCryptoService>(OpenPgpCryptoService)
    const identity = useDi<IIdentityService>(IdentityService)
    const cryptoPrefs = useDi<ICryptoPrefsService>(CryptoPrefsService)

    const [contacts, setContacts] = useState<ContactPlain[]>([])
    const [paste, setPaste] = useState("")
    const [nameHint, setNameHint] = useState("")
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
    const [visitInterpretation, setVisitInterpretation] =
        useState<VisitCardInterpretation>("auto")

    const [pasteBusy, setPasteBusy] = useState(false)
    const [reviewExpanded, setReviewExpanded] = useState(true)

    const exportLabels: ExportQrLabels = useMemo(
        () => ({
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
        }),
        [t],
    )

    const buildPreview = useCallback(
        async (
            raw: VisitCardRawPayload,
            mode: VisitCardInterpretation,
        ): Promise<QrPreviewInfo> => {
            const compactFail = (detail: string): QrPreviewInfo => ({
                valid: false,
                detail,
                displayName: null,
                publicKeyArmored: null,
                detectedProtocol: null,
                compactKeyPreview: null,
            })

            if (mode !== "openpgp") {
                let bytes: Uint8Array | null = typeof raw === "string" ? null : raw

                if (mode === "compact_v1" && typeof raw === "string") {
                    try {
                        bytes = base64ToBytes(raw.trim())
                    } catch {
                        return compactFail(t("contacts.reviewInvalidCompactPaste"))
                    }
                } else if (mode === "auto") {
                    bytes = typeof raw !== "string" ? raw : toCompactBytes(raw)
                }

                if (
                    bytes &&
                    isCompactVisitCardV1(bytes) &&
                    (mode === "compact_v1" || mode === "auto")
                ) {
                    const v = decodeVisitCardV1(bytes)

                    return {
                        valid: true,
                        detail: t("contacts.reviewCompactValid"),
                        displayName: v.displayName.trim() || null,
                        publicKeyArmored: null,
                        detectedProtocol: "compact_v1",
                        compactKeyPreview:
                            bytesToBase64(v.ed25519PublicKey).slice(0, 16) + "…",
                    }
                }

                if (mode === "compact_v1") {
                    return compactFail(t("contacts.reviewInvalidCompact"))
                }
            }

            try {
                const parsed = await pgp.parseVisitCard(raw)

                await pgp.validatePublicKeyArmored(parsed.publicKeyArmored)
                return {
                    valid: true,
                    detail: t("contacts.reviewKeyValid"),
                    displayName: parsed.displayName.trim() || null,
                    publicKeyArmored: parsed.publicKeyArmored.trim(),
                    detectedProtocol: "openpgp",
                    compactKeyPreview: null,
                }
            } catch (e) {
                return {
                    valid: false,
                    detail: e instanceof Error ? e.message : String(e),
                    displayName: null,
                    publicKeyArmored: null,
                    detectedProtocol: null,
                    compactKeyPreview: null,
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
        void buildPreview(pendingQr.raw, visitInterpretation).then((info) => {
            if (!cancelled) {
                setPreview(info)
                setPreviewLoading(false)
            }
        })

        return () => {
            cancelled = true
        }
    }, [pendingQr, buildPreview, visitInterpretation])

    const reload = async () => {
        setContacts(await conv.listContacts())
    }

    useEffect(() => {
        void reload()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
    }, [])

    const buildCard = async () => {
        const name = await identity.getSelfDisplayName()
        const format = await cryptoPrefs.getDefaultVisitCardFormat()

        if (format === "compact_v1") {
            await identity.ensureCompactIdentity()

            const raw = await identity.buildCompactVisitCard(name)
            setCardPayload(raw)
            setCardJson(bytesToBase64(raw))
            return
        }

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

    const addFromRaw = async (
        raw: VisitCardRawPayload,
        interpretation: VisitCardInterpretation,
    ): Promise<boolean> => {
        setMsg(null)

        try {
            await conv.addContactFromVisitCard(
                typeof raw === "string" ? raw.trim() : raw,
                nameHint.trim() || undefined,
                interpretation,
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

    const onPickQrImageFile = (file: File) => {
        setPasteBusy(true)
        setMsg(null)

        void (async () => {
            try {
                const reader = new BrowserQRCodeReader()
                const payload = await decodeQrFromImageBlob(reader, file)

                if (!payload) {
                    setMsg(t("contacts.pasteQrNoCode"))
                    return
                }

                setPendingQr({ raw: payload, source: "file" })
            } catch (e) {
                const reason = e instanceof Error ? e.message : String(e)
                setMsg(t("contacts.pasteQrFailed", { reason }))
            } finally {
                setPasteBusy(false)
            }
        })()
    }

    const confirmAddPending = async () => {
        if (!pendingQr) return
        const ok = await addFromRaw(pendingQr.raw, visitInterpretation)
        if (ok) discardPendingQr()
    }

    const interpretKey = visitInterpretation

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight">
                    {t("contacts.title")}
                </h1>
                {msg ? (
                    <p className="text-sm text-default-500">{msg}</p>
                ) : (
                    <p className="text-sm text-default-500">
                        {t("contacts.listEmpty")}
                    </p>
                )}
            </div>

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
                        <p className="text-xs text-default-500">
                            {t("qr.visitCardBinaryMax")}: {QR_VISIT_CARD_MAX_BYTES}.{" "}
                            {t("contacts.visitCardUsesPrefs")}
                        </p>
                    ) : undefined
                }
                shareFileName="cryptessage-visit-qr.png"
                shareTitle="cryptessage visit card"
                showArmoredPreview
            />

            <ImportQrBlock
                i18n={{
                    heading: t("contacts.addVisitCardSection"),
                    scan: t("contacts.addQr"),
                    pasteFromImage: t("contacts.pasteQr"),
                    pasteFromImagePending: t("contacts.pasteQrBusy"),
                    pickQrImage: t("contacts.pickQrImage"),
                    armoredSectionTitle: t("contacts.addPaste"),
                    armoredSubmit: t("contacts.addBtn"),
                    armoredPlaceholder:
                        "JSON visit card, or full -----BEGIN PGP PUBLIC KEY BLOCK----- (not fingerprint hex)",
                }}
                armored={{
                    value: paste,
                    onChange: setPaste,
                    onSubmit: () => void addFromRaw(paste, visitInterpretation),
                }}
                isProcessing={pasteBusy}
                armoredDisclosure={{
                    triggerLabel: t("contacts.addPaste"),
                    defaultExpanded: false,
                }}
                onPasteQrFromImage={() => void onPasteQrFromClipboard()}
                onPickQrImageFile={onPickQrImageFile}
                onScannedPayload={(payload) =>
                    setPendingQr({ raw: payload, source: "camera" })
                }
                nameHint={{
                    label: t("contacts.nameHint"),
                    value: nameHint,
                    onChange: setNameHint,
                }}
            >
                {pendingQr ? (
                    <Disclosure
                        isExpanded={reviewExpanded}
                        onExpandedChange={setReviewExpanded}
                    >
                        <Disclosure.Heading>
                            <Button slot="trigger" variant="secondary" size="sm">
                                {t("contacts.reviewTitle")}
                                <Disclosure.Indicator />
                            </Button>
                        </Disclosure.Heading>
                        <Disclosure.Content>
                            <Disclosure.Body className="mt-3">
                                <ImportQrPreviewShell
                                    title={t("contacts.reviewTitle")}
                                    metaLine={`${
                                        pendingQr.source === "camera"
                                            ? t("contacts.reviewSourceCamera")
                                            : pendingQr.source === "file"
                                                ? t("contacts.reviewSourceFile")
                                                : t("contacts.reviewSourceClipboard")
                                    } · ${t("contacts.reviewPayloadSize", {
                                        n: visitPayloadByteLength(pendingQr.raw),
                                    })}`}
                                    qrPayload={pendingQr.raw}
                                    maxQrBytes={QR_VISIT_CARD_MAX_BYTES}
                                    tooLongHint={t("contacts.reviewQrTooLong")}
                                >
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-default-500">
                                                {t("contacts.visitInterpretMode")}
                                            </p>
                                            <Tabs
                                                className="w-full"
                                                variant="secondary"
                                                selectedKey={interpretKey}
                                                onSelectionChange={(key: Key) => {
                                                    setVisitInterpretation(
                                                        String(key) as VisitCardInterpretation,
                                                    )
                                                }}
                                            >
                                                <Tabs.ListContainer>
                                                    <Tabs.List
                                                        aria-label={t(
                                                            "contacts.visitInterpretMode",
                                                        )}
                                                    >
                                                        <Tabs.Tab id="auto">
                                                            {t(
                                                                "contacts.visitInterpretAuto",
                                                            )}
                                                            <Tabs.Indicator />
                                                        </Tabs.Tab>
                                                        <Tabs.Tab id="openpgp">
                                                            <Tabs.Separator />
                                                            {t(
                                                                "contacts.visitInterpretOpenpgp",
                                                            )}
                                                            <Tabs.Indicator />
                                                        </Tabs.Tab>
                                                        <Tabs.Tab id="compact_v1">
                                                            <Tabs.Separator />
                                                            {t(
                                                                "contacts.visitInterpretCompact",
                                                            )}
                                                            <Tabs.Indicator />
                                                        </Tabs.Tab>
                                                    </Tabs.List>
                                                </Tabs.ListContainer>
                                            </Tabs>
                                        </div>

                                        {previewLoading ? (
                                            <div className="flex items-center gap-2 text-sm text-default-500">
                                                <Spinner size="sm" />
                                                {t("common.loading")}
                                            </div>
                                        ) : null}

                                        {!previewLoading && preview ? (
                                            <Surface
                                                className="space-y-2 rounded-2xl p-4"
                                                variant="default"
                                            >
                                                <div className="flex items-start gap-2">
                                                    {preview.valid ? (
                                                        <CheckCircle2 className="mt-0.5 size-5 text-success" />
                                                    ) : (
                                                        <XCircle className="mt-0.5 size-5 text-danger" />
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold">
                                                            {preview.valid
                                                                ? t("contacts.reviewValid")
                                                                : t("contacts.reviewInvalid")}
                                                        </p>
                                                        {preview.detectedProtocol ? (
                                                            <p className="text-xs text-default-500">
                                                                {t("contacts.reviewProtocol", {
                                                                    p: preview.detectedProtocol,
                                                                })}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                {preview.displayName ? (
                                                    <p className="text-sm">
                                                        <span className="text-default-500">
                                                            {t("contacts.reviewDisplayName")}:{" "}
                                                        </span>
                                                        {preview.displayName}
                                                    </p>
                                                ) : null}

                                                <p className="whitespace-pre-wrap break-words text-sm text-default-500">
                                                    {preview.detail}
                                                </p>

                                                {preview.compactKeyPreview ? (
                                                    <p className="text-xs text-default-500">
                                                        {t("contacts.reviewCompactPub")}:{" "}
                                                        {preview.compactKeyPreview}
                                                    </p>
                                                ) : null}

                                                {preview.publicKeyArmored ? (
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-medium text-default-500">
                                                            {t("contacts.reviewPublicKey")}
                                                        </p>
                                                        <TextArea
                                                            readOnly
                                                            value={preview.publicKeyArmored}
                                                            aria-label={t("contacts.reviewPublicKey")}
                                                            variant="secondary"
                                                            fullWidth
                                                            className="min-h-[140px] font-mono text-xs"
                                                        />
                                                    </div>
                                                ) : null}

                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    <Button
                                                        type="button"
                                                        isDisabled={
                                                            previewLoading || !preview.valid
                                                        }
                                                        onPress={() => void confirmAddPending()}
                                                    >
                                                        {t("contacts.addContactConfirm")}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="tertiary"
                                                        onPress={discardPendingQr}
                                                    >
                                                        {t("contacts.discardReview")}
                                                    </Button>
                                                </div>
                                            </Surface>
                                        ) : null}
                                    </div>
                                </ImportQrPreviewShell>
                            </Disclosure.Body>
                        </Disclosure.Content>
                    </Disclosure>
                ) : null}
            </ImportQrBlock>

            <Surface className="space-y-4 rounded-3xl p-5" variant="default">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold">{t("home.title")}</h2>
                    <div className="flex items-center gap-2 text-xs text-default-500">
                        <Contact2 className="size-4" aria-hidden />
                        {contacts.length}
                    </div>
                </div>

                {contacts.length === 0 ? (
                    <p className="text-sm text-default-500">
                        {t("contacts.listEmpty")}
                    </p>
                ) : (
                    <ul className="divide-y divide-divider">
                        {contacts.map((c) => (
                            <li key={c.id} className="py-3">
                                <Link
                                    to="/chat/$contactId"
                                    params={{ contactId: c.id }}
                                    className="group flex items-center justify-between gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-default-100"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">
                                            {c.displayName}
                                        </p>
                                        <p className="truncate text-xs text-default-500">
                                            {c.crypto.protocol}
                                        </p>
                                    </div>
                                    <span className="text-xs font-medium text-default-500 group-hover:text-foreground">
                                        {t("chat.open")} →
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </Surface>
        </div>
    )
}

