import { use } from "react"

import { DiContext } from "../di.context"

export const useDiContainer = () => {
    const di = use(DiContext)

    if (!di) {
        throw new Error("useDi must be used within a DiProvider")
    }

    return di
}
