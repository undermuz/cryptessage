import type { ILogger } from "../../types/logger"

export type EventEmitterCallback<
    Events extends BaseEvents = BaseEvents,
    K extends keyof Events = keyof Events,
> = (...args: Events[K]) => void

export type BaseEvents = {
    [key: string]: any[]
}

export const EventBusProvider = Symbol.for("EventBusProvider")

export interface EventEmitter<Events extends BaseEvents = BaseEvents> {
    on: <K extends keyof Events>(
        eventName: K,
        fn: EventEmitterCallback<Events, K>,
        safeLogger?: false | ILogger,
    ) => EventEmitterCallback<Events, K>
    off: <K extends keyof Events>(
        eventName: K,
        fn: EventEmitterCallback<Events, K>,
    ) => void
    emit: <K extends keyof Events>(eventName: K, ...data: Events[K]) => void
    destroy: () => void
}

export type IEventObserverOptions = {
    autoSafeLogger?: ILogger
    autoBindTo?: object
    source?: EventEmitter
}

export interface IEventObserver<
    Events extends BaseEvents = BaseEvents,
> extends EventEmitter<Events> {
    configure(opts: IEventObserverOptions): void
    connect(target: EventEmitter<Events>): void
}
