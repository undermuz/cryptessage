import { inject, injectable } from "inversify"

import type {
    BaseEvents,
    EventEmitter,
    EventEmitterCallback,
    IEventObserver,
    IEventObserverOptions,
} from "./types"

import type { ILogger } from "../../types/logger"
import type { ILoggerFactory } from "../../logger/types"
import { catchError } from "../common/catchError"

const IsObject = (obj: unknown) => typeof obj === "object" && obj !== null

const hasOwnProperty = (obj: unknown, name: any) =>
    IsObject(obj) && Object.prototype.hasOwnProperty.call(obj, name)

@injectable()
class EventObserver<
    Events extends BaseEvents = BaseEvents,
> implements IEventObserver<Events> {
    private options: IEventObserverOptions = {}

    private cbToFn: Map<
        EventEmitterCallback<Events, keyof Events>,
        EventEmitterCallback<Events, keyof Events>
    > = new Map()

    private listeners: {
        [K in keyof Events]?: Array<EventEmitterCallback<Events, K>>
    } = {}

    private targets: EventEmitter<Events>[] = []

    private logger: ILogger

    constructor(@inject("Factory<Logger>") loggerFactory: ILoggerFactory) {
        this.logger = loggerFactory("EventObserver")
    }

    public configure(opts: IEventObserverOptions) {
        this.options = opts
    }

    public connect(target: EventEmitter<Events>) {
        this.targets.push(target)
    }

    public destroy() {
        const events = Object.keys(this.listeners)

        for (const eventName of events) {
            const subscribers = this.listeners[eventName]

            if (!subscribers) {
                continue
            }

            for (const fn of subscribers) {
                this.cbToFn.delete(fn as any)

                for (const target of this.targets) {
                    target.off(eventName, fn)
                }
            }

            delete this.listeners[eventName]
        }
    }

    protected _unsubscribe<K extends keyof Events>(
        fn: EventEmitterCallback<Events, K>,
        eventName: K,
    ): boolean {
        const subscribers = this.listeners[eventName]

        if (!subscribers) {
            return false
        }

        let length = subscribers.length

        this.listeners[eventName] = subscribers.filter(
            (subscriber) => subscriber !== fn,
        )

        return length !== this.listeners[eventName]!.length
    }

    protected _subscribe<K extends keyof Events>(
        fn: EventEmitterCallback<Events, K>,
        eventName: K,
    ) {
        if (!hasOwnProperty(this.listeners, eventName)) {
            this.listeners[eventName] = []
        }

        this.listeners[eventName]!.push(fn)
    }

    protected unsubscribe<K extends keyof Events>(
        fn: EventEmitterCallback<Events, K>,
        eventName: K,
    ): boolean {
        for (const target of this.targets) {
            target.off(eventName, fn)
        }

        return this._unsubscribe(fn, eventName)
    }

    protected subscribe<K extends keyof Events>(
        fn: EventEmitterCallback<Events, K>,
        eventName: K,
    ) {
        for (const target of this.targets) {
            target.on(eventName, fn)
        }

        this._subscribe(fn, eventName)
    }

    protected _emit<K extends keyof Events>(eventName: K, ...data: Events[K]) {
        if (!(eventName in this.listeners)) {
            return
        }

        if (!this.listeners[eventName]) {
            return
        }

        if (!this.listeners[eventName]?.length) {
            return
        }

        try {
            for (let subscriber of this.listeners[eventName]) {
                subscriber.apply(null, data)
            }
        } catch (e) {
            this.logger.error(e)

            throw e
        }
    }

    public emit<K extends keyof Events>(eventName: K, ...data: Events[K]) {
        this.targets.forEach((target) => target.emit(eventName, ...data))

        this._emit(eventName, ...data)
    }

    public on<K extends keyof Events>(
        eventName: K,
        fn: EventEmitterCallback<Events, K>,
        safeLogger?: false | ILogger,
    ): EventEmitterCallback<Events, K> {
        const { autoSafeLogger, autoBindTo } = this.options

        const strEventName = String(eventName)

        safeLogger = safeLogger || autoSafeLogger

        let cb = autoBindTo ? fn.bind(autoBindTo) : fn

        if (safeLogger) {
            cb = catchError(cb, safeLogger, `[on: ${strEventName}]`)
        }

        this.cbToFn.set(
            fn as EventEmitterCallback<Events, keyof Events>,
            cb as EventEmitterCallback<Events, keyof Events>,
        )

        this.subscribe(cb, eventName)

        return cb
    }

    public off<K extends keyof Events>(
        eventName: K,
        fn: EventEmitterCallback<Events, K>,
    ) {
        const strEventName = String(eventName)

        const isSafe = this.cbToFn.has(fn as any)

        const cb = isSafe ? this.cbToFn.get(fn as any) : fn

        const isUnsubscribed = this.unsubscribe(cb as any, eventName)

        if (!isUnsubscribed) {
            this.logger.error(
                `[off: ${strEventName}][Error: Unsubscribed is failed]`,
                isSafe,
            )

            return
        }

        if (isSafe) {
            this.cbToFn.delete(fn as any)
        }
    }
}

export default EventObserver
