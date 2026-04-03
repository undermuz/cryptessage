export const MiddlewareProvider = Symbol.for("MiddlewareProvider")

export type Middleware<R> = (
    req: R,
    next: () => Promise<void>,
) => Promise<void> | void

export type IMiddlewareService<R = unknown, S = R> = {
    use: (middleware: Middleware<R>) => void
    handle: <_R extends R = R, _S extends S = S>(req: _R) => Promise<_S>
}

