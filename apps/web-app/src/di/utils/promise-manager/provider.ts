import { injectable } from "inversify"

export type PromiseManagerItem<V = unknown, E = Error> = {
    promise: Promise<V>
    resolve: (value: V) => void
    reject: (reason?: E) => void
    signal: AbortSignal
}

export const PromiseManagerProvider = Symbol.for("PromiseManagerProvider")

@injectable()
export class PromiseManager<
    Events extends Record<string, unknown> = Record<string, unknown>,
    EventKey extends keyof Events = keyof Events,
    E extends Error = Error,
> {
    private _statuses = new Map<EventKey, "pending" | "resolved" | "rejected">()

    private _promises: Map<EventKey, PromiseManagerItem<Events[EventKey], E>> =
        new Map()

    private _controllers = new Map<EventKey, AbortController>()

    protected cleanup(id: EventKey) {
        this._promises.delete(id)
        this._controllers.delete(id)
    }

    public reject(id: EventKey, reason?: E): boolean {
        if (!this._promises.has(id)) {
            return false
        }

        const item = this._promises.get(id)

        if (!item) {
            this.cleanup(id)

            return false
        }

        this._controllers.get(id)?.abort()

        item.reject(reason)
        this._statuses.set(id, "rejected")

        this.cleanup(id)

        return true
    }

    public abort(id: EventKey): boolean {
        return this.reject(id, new DOMException(`AbortError`) as unknown as E)
    }

    public resolve<K extends EventKey>(
        id: K,
        value: Events[EventKey],
    ): boolean {
        if (!this._promises.has(id)) {
            return false
        }

        const item = this._promises.get(id)

        if (!item) {
            this.cleanup(id)

            return false
        }

        item.resolve(value)
        this._statuses.set(id, "resolved")

        this.cleanup(id)

        return true
    }

    public getStatus(
        id: EventKey,
    ): "pending" | "resolved" | "rejected" | "none" {
        return this._statuses.get(id) ?? "none"
    }

    public create<K extends EventKey>(
        id: K,
        factory: (signal: AbortSignal) => Promise<Events[K]>,
    ): PromiseManagerItem<Events[K], E> {
        let item = this._promises.get(id) as
            | PromiseManagerItem<Events[K], E>
            | undefined

        if (!item) {
            const controller = new AbortController()

            const { promise, resolve, reject } =
                Promise.withResolvers<Events[K]>()

            item = {
                promise,
                resolve,
                reject: reject as unknown as (reason?: E) => void,
                signal: controller.signal,
            }

            this._promises.set(
                id,
                item as unknown as PromiseManagerItem<Events[EventKey], E>,
            )

            this._controllers.set(id, controller)

            factory(controller.signal)
                .then((value) => {
                    if (controller.signal.aborted) {
                        return
                    }

                    this.resolve(id, value)
                })
                .catch((reason) => {
                    if (controller.signal.aborted) {
                        return
                    }

                    this.reject(id, reason)
                })

            this._statuses.set(id, "pending")
        }

        return {
            promise: item.promise as Promise<Events[K]>,
            resolve: (value: Events[K]) => this.resolve(id, value),
            reject: (reason?: E) => this.reject(id, reason),
            signal: item.signal,
        }
    }

    public singletonPromise<K extends EventKey>(
        id: K,
        factory: (signal: AbortSignal) => Promise<Events[K]>,
    ): PromiseManagerItem<Events[K], E> {
        return this.create(id, factory)
    }

    public createExclusive<K extends EventKey>(
        id: K,
        factory: (signal: AbortSignal) => Promise<Events[K]>,
    ): PromiseManagerItem<Events[K], E> {
        this.abort(id)

        return this.create(id, factory)
    }

    public takeLatest<K extends EventKey>(
        id: K,
        factory: (signal: AbortSignal) => Promise<Events[K]>,
    ): PromiseManagerItem<Events[K], E> {
        return this.createExclusive(id, factory)
    }
}
