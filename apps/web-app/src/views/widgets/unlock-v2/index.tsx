import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"

import type { Key } from "@heroui/react"
import { Button, Input, Spinner, Surface, Tabs } from "@heroui/react"

import { useT } from "@/di/react/hooks/useT"
import { useDi } from "@/di/react/hooks/useDi"
import { AuthService, type IAuthService } from "@/di/auth/types"
import { IdentityService, type IIdentityService } from "@/di/identity/types"
import { VaultBackupService, type IVaultBackupService } from "@/di/vault-backup/types"

type Tab = "create" | "unlock" | "restore"

export function UnlockWidgetHeroUI() {
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
        if (!f) return

        const reader = new FileReader()
        reader.onload = () => {
            setFileJson(typeof reader.result === "string" ? reader.result : "")
        }
        reader.readAsText(f)
    }

    const tabKey = tab

    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
            <Surface
                className="w-full max-w-md space-y-6 rounded-3xl border border-divider p-6 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
                variant="secondary"
            >
                <div className="space-y-1">
                    <h1 className="text-xl font-semibold tracking-tight">
                        {t("unlock.title")}
                    </h1>
                    <p className="text-sm text-default-500">{t("unlock.subtitle")}</p>
                </div>

                <Tabs
                    className="w-full"
                    variant="secondary"
                    selectedKey={tabKey}
                    onSelectionChange={(key: Key) => {
                        setTab(String(key) as Tab)
                        setErr(null)
                    }}
                >
                    <Tabs.ListContainer>
                        <Tabs.List aria-label={t("unlock.title")}>
                            <Tabs.Tab id="unlock">
                                {t("unlock.tab.unlock")}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab id="create">
                                <Tabs.Separator />
                                {t("unlock.tab.create")}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab id="restore">
                                <Tabs.Separator />
                                {t("unlock.tab.restore")}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        </Tabs.List>
                    </Tabs.ListContainer>
                </Tabs>

                {tab === "create" && (
                    <form
                        className="space-y-3"
                        onSubmit={(e) => {
                            e.preventDefault()
                            void onCreate()
                        }}
                    >
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="off"
                            aria-label={t("unlock.displayName")}
                            variant="secondary"
                            fullWidth
                            placeholder={t("unlock.displayName")}
                        />
                        <Input
                            type="password"
                            value={pass}
                            onChange={(e) => setPass(e.target.value)}
                            autoComplete="new-password"
                            aria-label={t("unlock.passphrase")}
                            variant="secondary"
                            fullWidth
                            placeholder={t("unlock.passphrase")}
                        />
                        <Input
                            type="password"
                            value={pass2}
                            onChange={(e) => setPass2(e.target.value)}
                            autoComplete="new-password"
                            aria-label={t("unlock.passphraseRepeat")}
                            variant="secondary"
                            fullWidth
                            placeholder={t("unlock.passphraseRepeat")}
                        />

                        <Button
                            type="submit"
                            isDisabled={busy}
                            fullWidth
                        >
                            {busy ? <Spinner size="sm" /> : null}
                            {t("unlock.submitCreate")}
                        </Button>
                    </form>
                )}

                {tab === "unlock" && (
                    <form
                        className="space-y-3"
                        onSubmit={(e) => {
                            e.preventDefault()
                            void onUnlock()
                        }}
                    >
                        <Input
                            type="password"
                            value={pass}
                            onChange={(e) => setPass(e.target.value)}
                            autoComplete="current-password"
                            aria-label={t("unlock.passphrase")}
                            variant="secondary"
                            fullWidth
                            placeholder={t("unlock.passphrase")}
                        />

                        <Button
                            type="submit"
                            isDisabled={busy}
                            fullWidth
                        >
                            {busy ? <Spinner size="sm" /> : null}
                            {t("unlock.submitUnlock")}
                        </Button>
                    </form>
                )}

                {tab === "restore" && (
                    <form
                        className="space-y-3"
                        onSubmit={(e) => {
                            e.preventDefault()
                            void onRestore()
                        }}
                    >
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-default-500">
                                {t("unlock.backupJson")}
                            </p>
                            <input
                                type="file"
                                accept="application/json,.json"
                                className="block w-full text-sm text-default-500 file:mr-3 file:rounded-lg file:border-0 file:bg-default-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-default-200"
                                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                            />
                        </div>

                        <Input
                            type="password"
                            value={pass}
                            onChange={(e) => setPass(e.target.value)}
                            autoComplete="current-password"
                            aria-label={t("unlock.passphrase")}
                            variant="secondary"
                            fullWidth
                            placeholder={t("unlock.passphrase")}
                        />

                        <Button
                            type="submit"
                            isDisabled={busy || !fileJson}
                            fullWidth
                        >
                            {busy ? <Spinner size="sm" /> : null}
                            {t("unlock.submitRestore")}
                        </Button>
                    </form>
                )}

                {err ? (
                    <p className="text-sm text-danger" role="alert">
                        {err}
                    </p>
                ) : null}
            </Surface>
        </div>
    )
}

