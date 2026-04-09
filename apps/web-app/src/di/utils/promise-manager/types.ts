import type { PromiseManager } from "./provider"

export type PromiseManagerItem<V = unknown, E = Error> = {
    promise: Promise<V>
    resolve: (value: V) => void
    reject: (reason?: E) => void
    signal: AbortSignal
}

export const PromiseManagerProvider = Symbol.for("PromiseManagerProvider")

export interface IPromiseManager<
    Events extends Record<string, unknown> = Record<string, unknown>,
    EventKey extends keyof Events = keyof Events,
    E extends Error = Error,
> {
    /**
     * Get the status of a promise by id.
     */
    getStatus(id: EventKey): "pending" | "resolved" | "rejected" | "none"

    /**
     * Create or get a promise item for the given event key.
     * If already exists, returns existing item.
     */
    create<K extends EventKey>(
        id: K,
        factory: (signal: AbortSignal) => Promise<Events[K]>,
    ): PromiseManagerItem<Events[K], E>

    /**
     * Create a singleton promise (alias for create).
     */
    singletonPromise<K extends EventKey>(
        id: K,
        factory: (signal: AbortSignal) => Promise<Events[K]>,
    ): PromiseManagerItem<Events[K], E>

    /**
     * Create exclusive promise - aborts any existing promise with the same id.
     */
    createExclusive<K extends EventKey>(
        id: K,
        factory: (signal: AbortSignal) => Promise<Events[K]>,
    ): PromiseManagerItem<Events[K], E>

    /**
     * Take latest - alias for createExclusive.
     */
    takeLatest<K extends EventKey>(
        id: K,
        factory: (signal: AbortSignal) => Promise<Events[K]>,
    ): PromiseManagerItem<Events[K], E>

    /**
     * Resolve a promise by id.
     */
    resolve<K extends EventKey>(id: K, value: Events[`${string & K}`]): boolean

    /**
     * Reject a promise by id.
     */
    reject(id: EventKey, reason?: E): boolean

    /**
     * Abort a promise by id with AbortError.
     */
    abort(id: EventKey): boolean
}

export type { PromiseManager }
