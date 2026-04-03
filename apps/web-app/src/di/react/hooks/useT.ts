import { useEffect, useState } from "react"
import { useDi } from "./useDi"
import { I18nProvider, type I18nService } from "@/di/i18n/types"
import useConstant from "./useConstant"

export const useT = () => {
    const [, upd] = useState(0)

    const instance = useDi<I18nService>(I18nProvider)

    useEffect(() => {
        const unsubscribe = instance.onChange(() => {
            upd((_) => _ + 1)
        })

        return unsubscribe
    }, [instance])

    return useConstant(() => instance.t.bind(instance))
}
