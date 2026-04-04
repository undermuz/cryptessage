import { useEffect, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"
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
import type { ContactPlain, MessagePlain } from "@/di/crypt-db/types-data"
import {
    IdentityService,
    type IIdentityService,
} from "@/di/identity/types"
import { QR_MESSAGE_MAX_BYTES } from "@/di/secure/constants"
import { wrapOpenPgpBinaryForMessageQr } from "@/di/secure/message-qr-binary"
import {
    ExportQrBlock,
    type ExportQrLabels,
} from "@/views/widgets/qr-io/export-qr-block"
import { ImportQrBlock } from "@/views/widgets/qr-io/import-qr-block"
import { ImportQrPreviewShell } from "@/views/widgets/qr-io/import-qr-preview-shell"
import {
    decodeQrFromClipboardImage,
    decodeQrFromImageBlob,
} from "@/views/widgets/qr-scanner/clipboard-qr"

type ImportSource = "camera" | "clipboard" | "file"

function payloadByteLength(raw: VisitCardRawPayload): number {
    return typeof raw === "string"
        ? new TextEncoder().encode(raw).length
        : raw.byteLength
}

function isCiphertextForRecipientNotSelf(errMsg: string): boolean {
    return /no decryption key packets found/i.test(errMsg)
}

export function ChatThreadWidget() {
    const t = useT()
    const { contactId } = useParams({ from: "/authed/chat/$contactId" })
    const conv = useDi<IConversationService>(ConversationService)
    const pgp = useDi<IOpenPgpCryptoService>(OpenPgpCryptoService)
    const identity = useDi<IIdentityService>(IdentityService)

    const [contact, setContact] = useState<ContactPlain | null>(null)
    const [messages, setMessages] = useState<MessagePlain[]>([])
    const [plain, setPlain] = useState("")
    const [armoredOut, setArmoredOut] = useState("")
    const [messageQrPayload, setMessageQrPayload] = useState<Uint8Array | null>(
        null,
    )
    const [pasteIn, setPasteIn] = useState("")
    const [decrypted, setDecrypted] = useState("")
    const [sigOk, setSigOk] = useState<boolean | null>(null)
    const [warnLen, setWarnLen] = useState(false)
    const [toast, setToast] = useState<string | null>(null)

    const [exportQrExpanded, setExportQrExpanded] = useState(false)
    const [importScan, setImportScan] = useState(false)
    const [importPending, setImportPending] = useState<{
        raw: VisitCardRawPayload
        source: ImportSource
    } | null>(null)
    const [importDecryptLoading, setImportDecryptLoading] = useState(false)
    const [importDecryptPreview, setImportDecryptPreview] = useState<{
        text: string
        signaturesValid: boolean
    } | null>(null)
    const [importDecryptErr, setImportDecryptErr] = useState<string | null>(
        null,
    )
    const [pasteQrBusy, setPasteQrBusy] = useState(false)

    const [selfPublicKey, setSelfPublicKey] = useState<string | null>(null)

    const [inboundPreview, setInboundPreview] = useState<
        Record<
            string,
            | { ok: true; text: string; sig: boolean }
            | { ok: false; err: string }
        >
    >({})

    const [outboundPreview, setOutboundPreview] = useState<
        Record<
            string,
            | { ok: true; text: string; sig: boolean }
            | { ok: false; err: string }
        >
    >({})

    const reload = async () => {
        if (!contactId) {
            return
        }
        const c = await conv.getContact(contactId)
        setContact(c)
        setMessages(await conv.listMessages(contactId))
        try {
            setSelfPublicKey(await identity.getPublicKeyArmored())
        } catch {
            setSelfPublicKey(null)
        }
    }

    useEffect(() => {
        void reload()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when route id changes
    }, [contactId])

    useEffect(() => {
        if (armoredOut) {
            setExportQrExpanded(true)
        }
    }, [armoredOut])

    useEffect(() => {
        if (!importPending || !contact) {
            setImportDecryptLoading(false)
            setImportDecryptPreview(null)
            setImportDecryptErr(null)
            return
        }
        let cancelled = false
        setImportDecryptLoading(true)
        setImportDecryptPreview(null)
        setImportDecryptErr(null)
        void pgp
            .decryptAndVerify(
                importPending.raw,
                contact.publicKeyArmored,
            )
            .then((r) => {
                if (!cancelled) {
                    setImportDecryptPreview(r)
                    setImportDecryptErr(null)
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setImportDecryptPreview(null)
                    const raw = e instanceof Error ? e.message : String(e)
                    setImportDecryptErr(
                        isCiphertextForRecipientNotSelf(raw)
                            ? t("chat.errCannotDecryptOwnOutgoing")
                            : raw,
                    )
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setImportDecryptLoading(false)
                }
            })
        return () => {
            cancelled = true
        }
    }, [importPending, contact, pgp, t])

    useEffect(() => {
        if (!contact) {
            setInboundPreview({})
            return
        }
        const inbound = messages.filter((m) => m.direction === "in")
        if (inbound.length === 0) {
            setInboundPreview({})
            return
        }
        let cancelled = false
        void Promise.all(
            inbound.map(async (m) => {
                try {
                    const r = await pgp.decryptAndVerify(
                        m.armoredPayload,
                        contact.publicKeyArmored,
                    )
                    return [
                        m.id,
                        { ok: true, text: r.text, sig: r.signaturesValid },
                    ] as const
                } catch (e) {
                    const err = e instanceof Error ? e.message : String(e)
                    return [m.id, { ok: false, err }] as const
                }
            }),
        ).then((entries) => {
            if (!cancelled) {
                setInboundPreview(Object.fromEntries(entries))
            }
        })
        return () => {
            cancelled = true
        }
    }, [messages, contact, pgp])

    useEffect(() => {
        if (!selfPublicKey) {
            setOutboundPreview({})
            return
        }
        const outbound = messages.filter(
            (m) => m.direction === "out" && m.outboundSelfArmored,
        )
        if (outbound.length === 0) {
            setOutboundPreview({})
            return
        }
        let cancelled = false
        void Promise.all(
            outbound.map(async (m) => {
                try {
                    const r = await pgp.decryptAndVerify(
                        m.outboundSelfArmored!,
                        selfPublicKey,
                    )
                    return [
                        m.id,
                        {
                            ok: true,
                            text: r.text,
                            sig: r.signaturesValid,
                        },
                    ] as const
                } catch (e) {
                    const err = e instanceof Error ? e.message : String(e)
                    return [m.id, { ok: false, err }] as const
                }
            }),
        ).then((entries) => {
            if (!cancelled) {
                setOutboundPreview(Object.fromEntries(entries))
            }
        })
        return () => {
            cancelled = true
        }
    }, [messages, selfPublicKey, pgp])

    const onEncrypt = async () => {
        if (!contactId || !contact) {
            return
        }
        setArmoredOut("")
        setMessageQrPayload(null)
        setWarnLen(false)
        setToast(null)
        const { armored, binary } = await pgp.encryptAndSignForContactBundle(
            plain,
            contact.publicKeyArmored,
        )
        const wrapped = wrapOpenPgpBinaryForMessageQr(binary)
        setArmoredOut(armored)
        setMessageQrPayload(wrapped)
        await conv.saveOutboundArmored(contactId, armored, plain)
        await reload()
        if (wrapped.byteLength > QR_MESSAGE_MAX_BYTES) {
            setWarnLen(true)
        }
    }

    const onDecryptArmoredPaste = async () => {
        if (!contact) {
            return
        }
        setDecrypted("")
        setSigOk(null)
        setToast(null)
        try {
            const { text, signaturesValid } = await pgp.decryptAndVerify(
                pasteIn.trim(),
                contact.publicKeyArmored,
            )
            setDecrypted(text)
            setSigOk(signaturesValid)
            await conv.saveInboundArmored(contact.id, pasteIn.trim())
            await reload()
            setPasteIn("")
        } catch (e) {
            const raw = e instanceof Error ? e.message : String(e)
            setToast(
                isCiphertextForRecipientNotSelf(raw)
                    ? t("chat.errCannotDecryptOwnOutgoing")
                    : raw,
            )
        }
    }

    const confirmSaveScannedInbound = async () => {
        if (!importPending || !contact) {
            return
        }
        setToast(null)
        try {
            const armored = await pgp.ciphertextToArmored(importPending.raw)
            await conv.saveInboundArmored(contact.id, armored)
            setImportPending(null)
            setImportDecryptPreview(null)
            setImportDecryptErr(null)
            await reload()
            setToast(t("chat.saveInboundOk"))
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)
            setToast(t("chat.saveInboundFail", { reason }))
        }
    }

    const onPasteMessageQrFromClipboard = async () => {
        setPasteQrBusy(true)
        setToast(null)
        try {
            const reader = new BrowserQRCodeReader()
            const payload = await decodeQrFromClipboardImage(reader)
            if (!payload) {
                setToast(t("contacts.pasteQrNoCode"))
                return
            }
            setImportPending({ raw: payload, source: "clipboard" })
        } catch (e) {
            const reason = e instanceof Error ? e.message : String(e)
            setToast(t("contacts.pasteQrFailed", { reason }))
        } finally {
            setPasteQrBusy(false)
        }
    }

    const onPickMessageQrFromFile = (file: File) => {
        setPasteQrBusy(true)
        setToast(null)
        void (async () => {
            try {
                const reader = new BrowserQRCodeReader()
                const payload = await decodeQrFromImageBlob(reader, file)
                if (!payload) {
                    setToast(t("contacts.pasteQrNoCode"))
                    return
                }
                setImportPending({ raw: payload, source: "file" })
            } catch (e) {
                const reason = e instanceof Error ? e.message : String(e)
                setToast(t("contacts.pasteQrFailed", { reason }))
            } finally {
                setPasteQrBusy(false)
            }
        })()
    }

    const exportLabels: ExportQrLabels = {
        showQr: t("contacts.showQr"),
        hideQr: t("contacts.hideQr"),
        copyQrImage: t("contacts.copyQr"),
        shareQr: t("contacts.shareQr"),
        copyArmored: t("chat.copyArmored"),
        copyQrUnavailable: t("contacts.copyQrUnavailable"),
        copyQrFail: (reason) => t("contacts.copyQrFail", { reason }),
        copyQrOk: t("contacts.copyQrOk"),
        copyArmoredOk: t("chat.copyArmoredOk"),
        shareUnavailable: t("contacts.shareUnavailable"),
        shareFail: (reason) => t("contacts.shareFail", { reason }),
    }

    if (!contactId) {
        return null
    }

    if (contact === null) {
        return (
            <div className="space-y-2">
                <p className="text-muted-foreground">{t("unlock.error.generic")}</p>
                <Link to="/" className="text-sm text-primary underline">
                    {t("chat.back")}
                </Link>
            </div>
        )
    }

    const renderStoredMessageBody = (m: MessagePlain) => {
        if (m.direction === "out") {
            if (!m.outboundSelfArmored) {
                return (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("chat.outboundLegacyNoSelfCopy")}
                    </p>
                )
            }
            const prev = outboundPreview[m.id]
            if (!prev) {
                return (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("common.loading")}
                    </p>
                )
            }
            if (prev.ok) {
                return (
                    <div className="mt-1 space-y-1">
                        <p className="whitespace-pre-wrap text-sm text-foreground">
                            {prev.text}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            {prev.sig
                                ? t("chat.signatureOk")
                                : t("chat.signatureBad")}
                        </p>
                    </div>
                )
            }
            return (
                <p className="mt-1 text-sm text-destructive">{prev.err}</p>
            )
        }
        const prev = inboundPreview[m.id]
        if (!prev) {
            return (
                <p className="mt-1 text-sm text-muted-foreground">
                    {t("common.loading")}
                </p>
            )
        }
        if (prev.ok) {
            return (
                <div className="mt-1 space-y-1">
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                        {prev.text}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        {prev.sig
                            ? t("chat.signatureOk")
                            : t("chat.signatureBad")}
                    </p>
                </div>
            )
        }
        return <p className="mt-1 text-sm text-destructive">{prev.err}</p>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
                <h1 className="text-lg font-semibold">{contact.displayName}</h1>
                <Link to="/" className="text-sm text-muted-foreground underline">
                    {t("chat.back")}
                </Link>
            </div>

            <section className="space-y-3 rounded-lg border border-border p-4">
                <h2 className="text-sm font-medium">{t("chat.plainInput")}</h2>
                <textarea
                    className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={plain}
                    onChange={(e) => setPlain(e.target.value)}
                />
                <Button type="button" onClick={() => void onEncrypt()}>
                    {t("chat.encryptBtn")}
                </Button>
                {armoredOut && messageQrPayload && (
                    <ExportQrBlock
                        heading={t("chat.exportEncryptedSection")}
                        labels={exportLabels}
                        expanded={exportQrExpanded}
                        onExpandedChange={setExportQrExpanded}
                        qrPayload={messageQrPayload}
                        maxByteLength={QR_MESSAGE_MAX_BYTES}
                        armoredText={armoredOut}
                        onNotify={setToast}
                        showArmoredPreview
                        footer={
                            <div className="space-y-2 text-xs text-muted-foreground">
                                <p>
                                    {t("chat.exportForContactHint", {
                                        name: contact.displayName,
                                    })}
                                </p>
                                <p>
                                    {t("chat.qrBinaryHint", {
                                        max: QR_MESSAGE_MAX_BYTES,
                                    })}
                                </p>
                            </div>
                        }
                        oversizeWarning={warnLen}
                        oversizeMessage={
                            <p className="text-xs text-destructive">
                                {t("chat.qrTooLarge", {
                                    max: QR_MESSAGE_MAX_BYTES,
                                })}
                            </p>
                        }
                        shareFileName="cryptessage-message-qr.png"
                        shareTitle="cryptessage"
                    />
                )}
            </section>

            <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
                {t("chat.receiveOnlyIncomingHint", {
                    name: contact.displayName,
                })}
            </p>
            <ImportQrBlock
                heading={t("chat.receiveEncrypted")}
                labels={{
                    scan: t("chat.scanMessageQr"),
                    pasteFromImage: t("contacts.pasteQr"),
                    pasteFromImagePending: t("contacts.pasteQrBusy"),
                    pickQrImage: t("contacts.pickQrImage"),
                    armoredSectionTitle: t("chat.pasteIn"),
                    armoredSubmit: t("chat.decryptBtn"),
                }}
                armoredPlaceholder={t("chat.pasteArmoredPlaceholder")}
                armoredValue={pasteIn}
                onArmoredChange={setPasteIn}
                onArmoredSubmit={() => void onDecryptArmoredPaste()}
                armoredSubmitDisabled={!pasteIn.trim()}
                pasteBusy={pasteQrBusy}
                scanOpen={importScan}
                onOpenScan={() => setImportScan(true)}
                onCloseScan={() => setImportScan(false)}
                onPasteQrFromImage={() =>
                    void onPasteMessageQrFromClipboard()
                }
                onPickQrImageFile={onPickMessageQrFromFile}
                onScannedPayload={(payload) =>
                    setImportPending({ raw: payload, source: "camera" })
                }
                preview={
                    importPending ? (
                        <ImportQrPreviewShell
                            title={t("chat.reviewScannedCiphertext")}
                            metaLine={`${
                                importPending.source === "camera"
                                    ? t("contacts.reviewSourceCamera")
                                    : importPending.source === "file"
                                      ? t("contacts.reviewSourceFile")
                                      : t("contacts.reviewSourceClipboard")
                            } · ${t("contacts.reviewPayloadSize", {
                                n: payloadByteLength(importPending.raw),
                            })}`}
                            qrPayload={importPending.raw}
                            maxQrBytes={QR_MESSAGE_MAX_BYTES}
                            tooLongHint={t("contacts.reviewQrTooLong")}
                        >
                            {importDecryptLoading && (
                                <p className="text-muted-foreground">
                                    {t("common.loading")}
                                </p>
                            )}
                            {importDecryptErr && (
                                <p className="text-sm text-destructive">
                                    {importDecryptErr}
                                </p>
                            )}
                            {importDecryptPreview && (
                                <>
                                    <p className="text-sm font-medium">
                                        {t("chat.decrypted")}
                                    </p>
                                    <p className="rounded-md bg-muted p-2 text-sm">
                                        {importDecryptPreview.text}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {importDecryptPreview.signaturesValid
                                            ? t("chat.signatureOk")
                                            : t("chat.signatureBad")}
                                    </p>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <Button
                                            type="button"
                                            onClick={() =>
                                                void confirmSaveScannedInbound()
                                            }
                                        >
                                            {t("chat.saveInbound")}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setImportPending(null)
                                            }
                                        >
                                            {t("contacts.discardReview")}
                                        </Button>
                                    </div>
                                </>
                            )}
                            {!importDecryptLoading &&
                                importDecryptErr &&
                                !importDecryptPreview && (
                                    <div className="pt-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setImportPending(null)
                                            }
                                        >
                                            {t("contacts.discardReview")}
                                        </Button>
                                    </div>
                                )}
                        </ImportQrPreviewShell>
                    ) : undefined
                }
            />
            </div>

            {decrypted && (
                <div className="space-y-1 rounded-lg border border-border p-4">
                    <p className="text-sm font-medium">{t("chat.decrypted")}</p>
                    <p className="rounded-md bg-muted p-2 text-sm">{decrypted}</p>
                    <p className="text-xs text-muted-foreground">
                        {sigOk
                            ? t("chat.signatureOk")
                            : t("chat.signatureBad")}
                    </p>
                </div>
            )}

            {toast && (
                <p className="text-sm text-muted-foreground">{toast}</p>
            )}

            <section>
                <h2 className="mb-2 text-sm font-medium">{t("home.title")}</h2>
                <ul className="space-y-2 text-xs text-muted-foreground">
                    {messages.map((m) => (
                        <li
                            key={m.id}
                            className="rounded border border-border px-2 py-1"
                        >
                            <span className="font-medium text-foreground">
                                {m.direction === "out" ? "→" : "←"}
                            </span>{" "}
                            {new Date(m.createdAt).toLocaleString()}
                            {renderStoredMessageBody(m)}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    )
}
