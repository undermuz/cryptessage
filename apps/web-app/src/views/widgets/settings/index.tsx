import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"

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

export function SettingsWidget() {
    const t = useT()
    const navigate = useNavigate()
    const auth = useDi<IAuthService>(AuthService)
    const identity = useDi<IIdentityService>(IdentityService)
    const backup = useDi<IVaultBackupService>(VaultBackupService)
    const [fp, setFp] = useState("")
    const [publicArmored, setPublicArmored] = useState("")
    const [err, setErr] = useState<string | null>(null)

    useEffect(() => {
        void (async () => {
            try {
                setFp(await identity.getFingerprintHex())
            } catch {
                setFp("—")
            }
            try {
                setPublicArmored(await identity.getPublicKeyArmored())
            } catch {
                setPublicArmored("")
            }
        })()
    }, [identity])

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

    return (
        <div className="space-y-6">
            <h1 className="text-lg font-semibold">{t("settings.title")}</h1>

            <section className="space-y-2 rounded-lg border border-border p-4">
                <h2 className="text-sm font-medium">{t("settings.fingerprint")}</h2>
                <p className="break-all font-mono text-xs">{fp}</p>
                <p className="text-xs text-muted-foreground">
                    {t("settings.publicKeyHelp")}
                </p>
            </section>

            {publicArmored ? (
                <section className="space-y-2 rounded-lg border border-border p-4">
                    <h2 className="text-sm font-medium">{t("settings.publicKeyBlock")}</h2>
                    <textarea
                        readOnly
                        className="max-h-48 w-full resize-y rounded-md border border-input bg-muted/30 px-3 py-2 font-mono text-xs"
                        value={publicArmored}
                        aria-label={t("settings.publicKeyBlock")}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void navigator.clipboard.writeText(publicArmored)}
                    >
                        {t("settings.copyPublicKey")}
                    </Button>
                </section>
            ) : null}

            <section className="space-y-2 rounded-lg border border-border p-4">
                <h2 className="text-sm font-medium">{t("settings.exportBackup")}</h2>
                <p className="text-xs text-muted-foreground">
                    {t("settings.backupHint")}
                </p>
                <Button type="button" variant="outline" onClick={() => void onExport()}>
                    {t("settings.exportBackup")}
                </Button>
            </section>

            <Button type="button" variant="destructive" onClick={onLock}>
                {t("settings.lock")}
            </Button>

            {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
    )
}
