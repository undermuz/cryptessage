import { createContext } from "react"

import { type Container } from "inversify"

export const DiContext = createContext<Container | null>(null)
