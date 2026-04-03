import { useEffect, useState } from "react"
import { Link, useParams } from "@tanstack/react-router"

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
import type { ContactPlain, MessagePlain } from "@/di/crypt-db/types-data"
import { QR_PAYLOAD_MAX_CHARS } from "@/di/secure/constants"
import { VisitQrCanvas } from "@/views/widgets/visit-qr"

export function ChatThreadWidget() {
    const t = useT()
    const { contactId } = useParams({ from: "/authed/chat/$contactId" })
    const conv = useDi<IConversationService>(ConversationService)
    const pgp = useDi<IOpenPgpCryptoService>(OpenPgpCryptoService)

    const [contact, setContact] = useState<ContactPlain | null>(null)
    const [messages, setMessages] = useState<MessagePlain[]>([])
    const [plain, setPlain] = useState("")
    const [armoredOut, setArmoredOut] = useState("")
    const [pasteIn, setPasteIn] = useState("")
    const [decrypted, setDecrypted] = useState("")
    const [sigOk, setSigOk] = useState<boolean | null>(null)
    const [warnLen, setWarnLen] = useState(false)

    const reload = async () => {
        if (!contactId) {
            return
        }
        const c = await conv.getContact(contactId)
        setContact(c)
        setMessages(await conv.listMessages(contactId))
    }

    useEffect(() => {
        void reload()
        // conv is stable from DI; reload closes over latest conv
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when route id changes
    }, [contactId])

    const onEncrypt = async () => {
        if (!contactId || !contact) {
            return
        }
        setArmoredOut("")
        setWarnLen(false)
        const armored = await conv.encryptOutgoingMessage(contactId, plain)
        setArmoredOut(armored)
        await conv.saveOutboundArmored(contactId, armored)
        await reload()
        if (armored.length > QR_PAYLOAD_MAX_CHARS) {
            setWarnLen(true)
        }
    }

    const onDecrypt = async () => {
        if (!contact) {
            return
        }
        setDecrypted("")
        setSigOk(null)
        const { text, signaturesValid } = await pgp.decryptAndVerify(
            pasteIn.trim(),
            contact.publicKeyArmored,
        )
        setDecrypted(text)
        setSigOk(signaturesValid)
        await conv.saveInboundArmored(contact.id, pasteIn.trim())
        await reload()
        setPasteIn("")
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-2">
                <h1 className="text-lg font-semibold">{contact.displayName}</h1>
                <Link to="/" className="text-sm text-muted-foreground underline">
                    {t("chat.back")}
                </Link>
            </div>

            <section className="space-y-2 rounded-lg border border-border p-4">
                <h2 className="text-sm font-medium">{t("chat.plainInput")}</h2>
                <textarea
                    className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={plain}
                    onChange={(e) => setPlain(e.target.value)}
                />
                <Button type="button" onClick={() => void onEncrypt()}>
                    {t("chat.encryptBtn")}
                </Button>
                {armoredOut && (
                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-muted-foreground">
                            {t("chat.armoredOut")}
                        </label>
                        <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
                            {armoredOut}
                        </pre>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void navigator.clipboard.writeText(armoredOut)}
                        >
                            {t("chat.copyArmored")}
                        </Button>
                        <div className="rounded-md border border-border p-2">
                            <VisitQrCanvas
                                payload={armoredOut}
                                maxChars={QR_PAYLOAD_MAX_CHARS}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t("chat.qrHint", {
                                max: QR_PAYLOAD_MAX_CHARS,
                            })}
                        </p>
                        {warnLen && (
                            <p className="text-xs text-destructive">
                                {t("chat.qrHint", {
                                    max: QR_PAYLOAD_MAX_CHARS,
                                })}
                            </p>
                        )}
                    </div>
                )}
            </section>

            <section className="space-y-2 rounded-lg border border-border p-4">
                <h2 className="text-sm font-medium">{t("chat.pasteIn")}</h2>
                <textarea
                    className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
                    value={pasteIn}
                    onChange={(e) => setPasteIn(e.target.value)}
                />
                <Button type="button" onClick={() => void onDecrypt()}>
                    {t("chat.decryptBtn")}
                </Button>
                {decrypted && (
                    <div className="space-y-1">
                        <p className="text-sm font-medium">{t("chat.decrypted")}</p>
                        <p className="rounded-md bg-muted p-2 text-sm">{decrypted}</p>
                        <p className="text-xs text-muted-foreground">
                            {sigOk
                                ? t("chat.signatureOk")
                                : t("chat.signatureBad")}
                        </p>
                    </div>
                )}
            </section>

            <section>
                <h2 className="mb-2 text-sm font-medium">{t("home.title")}</h2>
                <ul className="space-y-2 text-xs text-muted-foreground">
                    {messages.map((m) => (
                        <li key={m.id} className="rounded border border-border px-2 py-1">
                            <span className="font-medium text-foreground">
                                {m.direction === "out" ? "→" : "←"}
                            </span>{" "}
                            {new Date(m.createdAt).toLocaleString()}
                            <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-mono">
                                {m.armoredPayload.slice(0, 200)}
                                {m.armoredPayload.length > 200 ? "…" : ""}
                            </pre>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    )
}
