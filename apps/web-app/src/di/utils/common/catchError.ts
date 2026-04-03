import { ILogger } from "../../types/logger"

export function catchError<T extends unknown[] = unknown[]>(
    fn: (...args: T) => unknown,
    logger: ILogger,
    prefix?: string,
) {
    return async function (...args: T) {
        try {
            return await fn(...args)
        } catch (e) {
            logger.error(e)

            if (prefix)
                logger.error(`${prefix}[Error: ${(e as Error)?.message}]`)
            return undefined
        }
    }
}
