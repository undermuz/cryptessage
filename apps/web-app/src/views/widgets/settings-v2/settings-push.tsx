import { useCallback, useEffect, useState } from "react"

import { Button, Surface, Switch } from "@heroui/react"

import { useT } from "@/di/react/hooks/useT"
import { useDi } from "@/di/react/hooks/useDi"
import {
    PushNotificationsService,
    type IPushNotificationsService,
    type PushNotificationStatus,
} from "@/di/push-notifications/types"

function mapPushError(t: (k: string) => string, code: string): string {
    switch (code) {
        case "WEB_PUSH_PUBLIC_KEY_MISSING":
            return t("settings.push.error.noVapid")
        case "PUSH_NOT_SUPPORTED":
            return t("settings.push.error.unsupported")
        case "NOTIFICATION_PERMISSION_DENIED":
            return t("settings.push.error.permissionDenied")
        default:
            return t("settings.push.error.generic")
    }
}

function isLikelyIos(): boolean {
    if (typeof navigator === "undefined") {
        return false
    }

    return (
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    )
}

function isStandaloneDisplay(): boolean {
    if (typeof window === "undefined") {
        return false
    }

    return window.matchMedia("(display-mode: standalone)").matches
}

export function SettingsPush() {
    const t = useT()
    const push = useDi<IPushNotificationsService>(PushNotificationsService)

    const [status, setStatus] = useState<PushNotificationStatus | null>(null)
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const [testBusy, setTestBusy] = useState(false)

    const refresh = useCallback(async () => {
        setStatus(await push.getStatus())
    }, [push])

    useEffect(() => {
        let alive = true

        void (async () => {
            await push.initialize()

            if (!alive) {
                return
            }

            await refresh()
        })()

        return () => {
            alive = false
        }
    }, [push, refresh])

    if (!status) {
        return (
            <Surface className="space-y-3 rounded-3xl p-5" variant="default">
                <h2 className="text-sm font-semibold">{t("settings.push.title")}</h2>
                <p className="text-sm text-default-500">{t("common.loading")}</p>
            </Surface>
        )
    }

    const ios = isLikelyIos()
    const standalone = isStandaloneDisplay()
    const showIosHint = ios && !standalone && status.supported
    const switchDisabled =
        !status.supported ||
        !status.configured ||
        status.permission === "denied" ||
        busy
    const pushEnabled =
        status.subscribed && status.permission === "granted"
    const testDisabled =
        !status.supported ||
        status.permission !== "granted" ||
        testBusy

    const onPushSwitch = async (next: boolean) => {
        setErr(null)
        setBusy(true)

        try {
            if (next) {
                await push.enable()
            } else {
                await push.disable()
            }

            await refresh()
        } catch (e) {
            const code = e instanceof Error ? e.message : "generic"

            setErr(mapPushError(t, code))
            await refresh()
        } finally {
            setBusy(false)
        }
    }

    const onTest = async () => {
        setErr(null)
        setTestBusy(true)

        try {
            await push.showTestNotification()
        } catch (e) {
            const code = e instanceof Error ? e.message : "generic"

            setErr(mapPushError(t, code))
        } finally {
            setTestBusy(false)
        }
    }

    return (
        <Surface className="space-y-4 rounded-3xl p-5" variant="default">
            <div className="space-y-1">
                <h2 className="text-sm font-semibold">{t("settings.push.title")}</h2>
                <p className="text-xs text-default-500">{t("settings.push.hint")}</p>
            </div>

            {!status.supported ? (
                <p className="text-sm text-default-600">
                    {t("settings.push.unsupportedDetail")}
                </p>
            ) : null}

            {status.supported && !status.configured ? (
                <p className="text-sm text-warning-600">
                    {t("settings.push.noVapidDetail")}
                </p>
            ) : null}

            {status.permission === "denied" ? (
                <p className="text-sm text-warning-600">
                    {t("settings.push.permissionDeniedDetail")}
                </p>
            ) : null}

            {showIosHint ? (
                <p className="text-sm text-default-600">{t("settings.push.iosPwaHint")}</p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                    <p className="text-sm font-medium">{t("settings.push.enable")}</p>
                    <p className="text-xs text-default-500">
                        {t("settings.push.enableHint")}
                    </p>
                </div>
                <Switch
                    size="sm"
                    isSelected={pushEnabled}
                    isDisabled={switchDisabled}
                    onChange={(selected) => void onPushSwitch(selected)}
                    aria-label={t("settings.push.enable")}
                >
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                </Switch>
            </div>

            <div className="space-y-2">
                <Button
                    type="button"
                    variant="tertiary"
                    size="sm"
                    isDisabled={testDisabled}
                    isPending={testBusy}
                    onPress={() => void onTest()}
                >
                    {t("settings.push.test")}
                </Button>
                <p className="text-xs text-default-500">{t("settings.push.testHint")}</p>
            </div>

            {err ? <p className="text-sm text-danger">{err}</p> : null}

            <p className="text-xs text-default-500">{t("settings.push.payloadHint")}</p>
        </Surface>
    )
}
