"use client"

import { FC, PropsWithChildren } from "react"

import { createDiContainer } from "../container"

import { DiContext } from "./di.context"

import useConstant from "./hooks/useConstant"

export const DiProvider: FC<PropsWithChildren> = ({ children }) => {
    const di = useConstant(() => createDiContainer())

    return <DiContext.Provider value={di}>{children}</DiContext.Provider>
}
