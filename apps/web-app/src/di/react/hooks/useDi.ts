import { ServiceIdentifier } from "inversify"

import useConstant from "./useConstant"

import { useDiContainer } from "./useDiContainer"

export function useDi<T>(token: ServiceIdentifier<T>, isAsync: true): Promise<T>
export function useDi<T>(token: ServiceIdentifier<T>, isAsync?: false): T
export function useDi<T>(
    token: ServiceIdentifier<T>,
    isAsync = false,
): T | Promise<T> {
    const di = useDiContainer()

    return useConstant(() => {
        if (isAsync) {
            return di.getAsync(token)
        }

        return di.get(token)
    })
}
