import { injectable } from "inversify"
import type { IMiddlewareService, Middleware } from "./types"

export function compose<R>(middlewares: Middleware<R>[]) {
    return (req: R): Promise<void> => {
        const dispatch = (i: number): Promise<void> => {
            const middleware = middlewares[i]

            if (!middleware) return Promise.resolve()

            return Promise.resolve(middleware(req, () => dispatch(i + 1)))
        }

        return dispatch(0)
    }
}

@injectable()
export class MiddlewareService<R, S = R> implements IMiddlewareService<R, S> {
    private middlewares: Middleware<R>[] = []

    protected _getResult: ((req: R) => S) | null = null

    public get getResult(): (req: R) => S {
        if (!this._getResult) {
            throw new Error("Get result is not defined")
        }

        return this._getResult
    }

    public initialize(getResult: (req: R) => S) {
        this._getResult = getResult
    }

    public use(middleware: Middleware<R>): void {
        this.middlewares.push(middleware)
    }

    public async handle<_R extends R = R, _S extends S = S>(
        req: _R,
    ): Promise<_S> {
        await compose(this.middlewares)(req)

        return this.getResult(req) as _S
    }

    public clear() {
        this.middlewares = []
        this._getResult = null
    }
}
