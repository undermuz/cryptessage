import { useEffect, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { Button } from "@/views/ui/button"
import { useT } from "@/di/react/hooks/useT"
import { useDi } from "@/di/react/hooks/useDi"
import { AuthService, type IAuthService } from "@/di/auth/types"
import {
    IdentityService,
    type IIdentityService,
} from "@/di/identity/types"
import {
    VaultBackupService,
    type IVaultBackupService,
} from "@/di/vault-backup/types"

type Tab = "create" | "unlock" | "restore"

export function UnlockWidget() {
    const t = useT()
    const navigate = useNavigate()
    const search = useSearch({ from: "/unlock" })
    const auth = useDi<IAuthService>(AuthService)
    const identity = useDi<IIdentityService>(IdentityService)
    const backup = useDi<IVaultBackupService>(VaultBackupService)

    const [tab, setTab] = useState<Tab>("unlock")

    useEffect(() => {
        void auth.hasVault().then((exists) => {
            if (!exists) {
                setTab("create")
            }
        })
    }, [auth])
    const [pass, setPass] = useState("")
    const [pass2, setPass2] = useState("")
    const [name, setName] = useState("")
    const [fileJson, setFileJson] = useState("")
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const goNext = () => {
        const target = search.redirect?.startsWith("/") ? search.redirect : "/"
        void navigate({ to: target })
    }

    const afterSession = async () => {
        if (!(await identity.hasIdentity())) {
            await identity.ensureIdentity(name.trim() || "User")
        }
        await identity.ensureCompactIdentity()
    }

    const onCreate = async () => {
        setErr(null)
        if (pass !== pass2) {
            setErr(t("unlock.error.passMismatch"))
            return
        }
        setBusy(true)
        try {
            const exists = await auth.hasVault()
            if (exists) {
                setErr(t("unlock.error.generic"))
                setBusy(false)
                return
            }
            await auth.bootstrapNewVault(pass)
            await identity.ensureIdentity(name.trim() || "User")
            goNext()
        } catch {
            setErr(t("unlock.error.generic"))
        } finally {
            setBusy(false)
        }
    }

    const onUnlock = async () => {
        setErr(null)
        setBusy(true)
        try {
            await auth.unlock(pass)
            await afterSession()
            goNext()
        } catch {
            setErr(t("unlock.error.generic"))
        } finally {
            setBusy(false)
        }
    }

    const onRestore = async () => {
        setErr(null)
        setBusy(true)
        try {
            await backup.importEncryptedBackup(pass, fileJson)
            goNext()
        } catch {
            setErr(t("unlock.error.generic"))
        } finally {
            setBusy(false)
        }
    }

    const onFile = (f: File | null) => {
        if (!f) {
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            setFileJson(typeof reader.result === "string" ? reader.result : "")
        }
        reader.readAsText(f)
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
            <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
                <div>
                    <h1 className="text-xl font-semibold">{t("unlock.title")}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("unlock.subtitle")}
                    </p>
                </div>

                <div className="flex gap-2 border-b border-border pb-2">
                    {(
                        [
                            ["unlock", "unlock.tab.unlock"],
                            ["create", "unlock.tab.create"],
                            ["restore", "unlock.tab.restore"],
                        ] as const
                    ).map(([k, labelKey]) => (
                        <button
                            key={k}
                            type="button"
                            className={`rounded-md px-3 py-1.5 text-sm ${
                                tab === k
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                            }`}
                            onClick={() => {
                                setTab(k)
                                setErr(null)
                            }}
                        >
                            {t(labelKey)}
                        </button>
                    ))}
                </div>

                {tab === "create" && (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium">
                            {t("unlock.displayName")}
                            <input
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="off"
                            />
                        </label>
                        <label className="block text-sm font-medium">
                            {t("unlock.passphrase")}
                            <input
                                type="password"
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={pass}
                                onChange={(e) => setPass(e.target.value)}
                                autoComplete="new-password"
                            />
                        </label>
                        <label className="block text-sm font-medium">
                            {t("unlock.passphraseRepeat")}
                            <input
                                type="password"
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={pass2}
                                onChange={(e) => setPass2(e.target.value)}
                                autoComplete="new-password"
                            />
                        </label>
                        <Button
                            type="button"
                            className="w-full"
                            disabled={busy}
                            onClick={() => void onCreate()}
                        >
                            {t("unlock.submitCreate")}
                        </Button>
                    </div>
                )}

                {tab === "unlock" && (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium">
                            {t("unlock.passphrase")}
                            <input
                                type="password"
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={pass}
                                onChange={(e) => setPass(e.target.value)}
                                autoComplete="current-password"
                            />
                        </label>
                        <Button
                            type="button"
                            className="w-full"
                            disabled={busy}
                            onClick={() => void onUnlock()}
                        >
                            {t("unlock.submitUnlock")}
                        </Button>
                    </div>
                )}

                {tab === "restore" && (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium">
                            {t("unlock.backupJson")}
                            <input
                                type="file"
                                accept="application/json,.json"
                                className="mt-1 w-full text-sm"
                                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                            />
                        </label>
                        <label className="block text-sm font-medium">
                            {t("unlock.passphrase")}
                            <input
                                type="password"
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={pass}
                                onChange={(e) => setPass(e.target.value)}
                                autoComplete="current-password"
                            />
                        </label>
                        <Button
                            type="button"
                            className="w-full"
                            disabled={busy || !fileJson}
                            onClick={() => void onRestore()}
                        >
                            {t("unlock.submitRestore")}
                        </Button>
                    </div>
                )}

                {err && (
                    <p className="text-sm text-destructive" role="alert">
                        {err}
                    </p>
                )}
            </div>
        </div>
    )
}
