import { useEffect, useState } from "react"

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

    const addFromRaw = async (raw: string) => {
        setMsg(null)
        try {
            await conv.addContactFromVisitCard(raw.trim(), nameHint.trim() || undefined)
            setPaste("")
            setNameHint("")
            await reload()
            setMsg(t("contacts.addOk"))
        } catch (e) {
            console.error("[contacts] addContactFromVisitCard", e)
            const reason = e instanceof Error ? e.message : String(e)
            setMsg(t("contacts.addFailed", { reason }))
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
                    <div className="mt-2">
                        <VisitQrCanvas
                            payload={cardPayload}
                            maxChars={QR_PAYLOAD_MAX_CHARS}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                            {t("qr.maxChars")}: {QR_PAYLOAD_MAX_CHARS}
                        </p>
                    </div>
                )}
            </section>

            <section className="space-y-3 rounded-lg border border-border p-4">
                <h2 className="text-sm font-medium">{t("contacts.addQr")}</h2>
                {!scan ? (
                    <Button type="button" onClick={() => setScan(true)}>
                        {t("contacts.addQr")}
                    </Button>
                ) : (
                    <QrScannerPanel
                        onResult={(text) => {
                            setScan(false)
                            void addFromRaw(text)
                        }}
                        onClose={() => setScan(false)}
                    />
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
