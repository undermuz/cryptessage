import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Copy, Download, Lock } from "lucide-react"

import type { Key } from "@heroui/react"
import { Button, Spinner, Surface, Tabs, TextArea } from "@heroui/react"

import { useTheme, type ThemePreference } from "@/app/theme"
import { useT } from "@/di/react/hooks/useT"
import { useDi } from "@/di/react/hooks/useDi"
import type { CryptoProtocolId } from "@/di/crypt-db/crypto-protocol"
import { AuthService, type IAuthService } from "@/di/auth/types"
import {
    CryptoPrefsService,
    type ICryptoPrefsService,
} from "@/di/crypto-prefs/types"
import { IdentityService, type IIdentityService } from "@/di/identity/types"
import {
    VaultBackupService,
    type IVaultBackupService,
} from "@/di/vault-backup/types"

import { SettingsTransportsHeroUI } from "./settings-transports.heroui"

export function SettingsWidgetHeroUI() {
    const t = useT()
    const { preference, setPreference } = useTheme()
    const navigate = useNavigate()

    const auth = useDi<IAuthService>(AuthService)
    const identity = useDi<IIdentityService>(IdentityService)
    const cryptoPrefs = useDi<ICryptoPrefsService>(CryptoPrefsService)
    const backup = useDi<IVaultBackupService>(VaultBackupService)

    const [fp, setFp] = useState<string>("")
    const [publicArmored, setPublicArmored] = useState<string>("")
    const [cryptErr, setCryptErr] = useState<string | null>(null)
    const [visitCardFormat, setVisitCardFormat] =
        useState<CryptoProtocolId>("openpgp")
    const [err, setErr] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let alive = true

        void (async () => {
            try {
                const [fpRes, pubRes, fmtRes] = await Promise.allSettled([
                    identity.getFingerprintHex(),
                    identity.getPublicKeyArmored(),
                    cryptoPrefs.getDefaultVisitCardFormat(),
                ])

                if (!alive) return

                setFp(fpRes.status === "fulfilled" ? fpRes.value : "—")
                setPublicArmored(
                    pubRes.status === "fulfilled" ? pubRes.value : "",
                )
                setVisitCardFormat(
                    fmtRes.status === "fulfilled" ? fmtRes.value : "openpgp",
                )
            } finally {
                if (alive) setLoading(false)
            }
        })()

        return () => {
            alive = false
        }
    }, [identity, cryptoPrefs])

    const onLock = () => {
        auth.lock()
        void navigate({ to: "/unlock" })
    }

    const onExport = async () => {
        setErr(null)

        try {
            const json = await backup.exportEncryptedBackup()
            const blob = new Blob([json], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")

            a.href = url
            a.download = `cryptessage-backup-${Date.now()}.json`
            a.click()
            URL.revokeObjectURL(url)
        } catch {
            setErr(t("unlock.error.generic"))
        }
    }

    const themeKey = preference
    const visitKey = visitCardFormat

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight">
                    {t("settings.title")}
                </h1>
                <p className="text-sm text-default-500">
                    {t("settings.themeHint")}
                </p>
            </div>

            {loading ? (
                <Surface
                    className="flex items-center gap-3 rounded-3xl border border-divider p-6"
                    variant="secondary"
                >
                    <Spinner size="sm" />
                    <span className="text-sm text-default-500">
                        {t("common.loading")}
                    </span>
                </Surface>
            ) : null}

            <Surface className="space-y-4 rounded-3xl p-5" variant="secondary">
                <div className="space-y-1">
                    <h2 className="text-sm font-semibold">
                        {t("settings.appearance")}
                    </h2>
                    <p className="text-xs text-default-500">
                        {t("settings.themeHint")}
                    </p>
                </div>

                <Tabs
                    className="w-full"
                    variant="secondary"
                    selectedKey={themeKey}
                    onSelectionChange={(key: Key) =>
                        setPreference(String(key) as ThemePreference)
                    }
                >
                    <Tabs.ListContainer>
                        <Tabs.List aria-label={t("settings.appearance")}>
                            <Tabs.Tab id="system">
                                {t("settings.themeSystem")}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab id="light">
                                <Tabs.Separator />

                                {t("settings.themeLight")}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab id="dark">
                                <Tabs.Separator />

                                {t("settings.themeDark")}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        </Tabs.List>
                    </Tabs.ListContainer>
                </Tabs>
            </Surface>

            <Surface className="space-y-4 rounded-3xl p-5" variant="secondary">
                <div className="space-y-1">
                    <h2 className="text-sm font-semibold">
                        {t("settings.visitCardFormat")}
                    </h2>
                    <p className="text-xs text-default-500">
                        {t("settings.visitCardFormatHint")}
                    </p>
                </div>

                <Tabs
                    className="w-full"
                    variant="secondary"
                    selectedKey={visitKey}
                    onSelectionChange={(key: Key) => {
                        const v = String(key) as CryptoProtocolId

                        setVisitCardFormat(v)

                        void (async () => {
                            setCryptErr(null)

                            try {
                                if (v === "compact_v1") {
                                    await identity.ensureCompactIdentity()
                                }

                                await cryptoPrefs.setDefaultVisitCardFormat(v)
                            } catch (ex) {
                                const reason =
                                    ex instanceof Error ? ex.message : String(ex)

                                setCryptErr(reason)
                            }
                        })()
                    }}
                >
                    <Tabs.ListContainer>
                        <Tabs.List aria-label={t("settings.visitCardFormat")}>
                            <Tabs.Tab id="openpgp">
                                {t("settings.visitCardOpenpgp")}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab id="compact_v1">
                                <Tabs.Separator />

                                {t("settings.visitCardCompact")}
                                <Tabs.Indicator />
                            </Tabs.Tab>
                        </Tabs.List>
                    </Tabs.ListContainer>
                </Tabs>

                {cryptErr ? (
                    <p className="text-sm text-danger">{cryptErr}</p>
                ) : null}
            </Surface>

            <SettingsTransportsHeroUI />

            <Surface className="space-y-3 rounded-3xl p-5" variant="secondary">
                <h2 className="text-sm font-semibold">{t("settings.fingerprint")}</h2>
                <p className="break-all font-mono text-xs text-foreground">{fp}</p>
                <p className="text-xs text-default-500">
                    {t("settings.publicKeyHelp")}
                </p>
            </Surface>

            {publicArmored ? (
                <Surface className="space-y-3 rounded-3xl p-5" variant="secondary">
                    <h2 className="text-sm font-semibold">
                        {t("settings.publicKeyBlock")}
                    </h2>
                    <div className="relative">
                        <TextArea
                            readOnly
                            value={publicArmored}
                            aria-label={t("settings.publicKeyBlock")}
                            variant="secondary"
                            fullWidth
                            className="w-full min-h-[160px] font-mono text-xs pr-12"
                        />
                        <div className="absolute right-2 top-2">
                            <Button
                                isIconOnly
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label={t("settings.copyPublicKey")}
                                onPress={() =>
                                    void navigator.clipboard.writeText(publicArmored)
                                }
                            >
                                <Copy className="size-4" />
                            </Button>
                        </div>
                    </div>
                </Surface>
            ) : null}

            <Surface className="space-y-3 rounded-3xl p-5" variant="secondary">
                <div className="space-y-1">
                    <h2 className="text-sm font-semibold">
                        {t("settings.exportBackup")}
                    </h2>
                    <p className="text-xs text-default-500">
                        {t("settings.backupHint")}
                    </p>
                </div>
                <Button type="button" variant="outline" onPress={() => void onExport()}>
                    <Download className="size-4" />
                    {t("settings.exportBackup")}
                </Button>
                {err ? <p className="text-sm text-danger">{err}</p> : null}
            </Surface>

            <div className="pt-2">
                <Button type="button" variant="danger" onPress={onLock}>
                    <Lock className="size-4" />
                    {t("settings.lock")}
                </Button>
            </div>
        </div>
    )
}

